const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch'); // npm install node-fetch@2
const URL = require('url').URL;

const app = express();
const PORT = process.env.PORT || 3001;

// -----------------------------------------------------------------------------
// In‐Memory Storage (for demo; replace with real DB in production)
const users = new Map();           // username → { id, passwordHash, createdAt }
const activeStreams = new Map();   // userId → [ { infoHash, fileIndex, … } ]
// -----------------------------------------------------------------------------

// --- Middleware ----------------------------------------------------------------
// Parse JSON bodies
app.use(express.json());

// JWT authentication middleware (expects "Authorization: Bearer <token>")
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user; // { userId, username }
    next();
  });
};

// Helper: extract the 40-char infoHash from a magnet URI (lowercased)
const extractInfoHash = (magnetLink) => {
  const match = magnetLink.match(/xt=urn:btih:([A-Za-z0-9]+)/);
  return match ? match[1].toLowerCase() : null;
};
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Auth Endpoints
// -----------------------------------------------------------------------------

// POST /api/register  { username, password } → { token, user }
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (users.has(username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();
    users.set(username, {
      id: userId,
      password: hashedPassword,
      createdAt: new Date()
    });
    const token = jwt.sign({ userId, username }, process.env.JWT_SECRET);
    res.json({ token, user: { id: userId, username } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/login  { username, password } → { token, user }
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const user = users.get(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, username }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.id, username } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// -----------------------------------------------------------------------------
// Search Endpoint (Jackett integration)
// -----------------------------------------------------------------------------

// GET /api/search?query=…  (authenticated)
app.get('/api/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    const jackettUrl = `${process.env.JACKETT_URL}/api/v2.0/indexers/all/results`;
    const params = new URLSearchParams({
      apikey: process.env.JACKETT_API_KEY,
      Query: query
    });
    const response = await fetch(`${jackettUrl}?${params}`, {
      headers: {
        'Authorization': 'Basic ' +
          Buffer.from(`torrentSite:${process.env.JACKETT_API_KEY}`).toString('base64')
      }
    });
    if (!response.ok) {
      throw new Error(`Jackett request failed (status ${response.status})`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// -----------------------------------------------------------------------------
// Stream Creation Endpoint (Stremio)
// -----------------------------------------------------------------------------

// POST /api/stream  { magnetLink, movieTitle }
//   → { streamUrl, infoHash, movieTitle, message, streamingType, needsTranscoding }
app.post('/api/stream', authenticateToken, async (req, res) => {
  try {
    const { magnetLink, movieTitle } = req.body;
    const userId = req.user.userId;

    // Validate magnetLink format
    if (!magnetLink || !magnetLink.startsWith('magnet:?xt=urn:btih:')) {
      return res.status(400).json({ error: 'Invalid magnet link format' });
    }

    // Extract infoHash (lowercase)
    const infoHash = extractInfoHash(magnetLink);
    if (!infoHash) {
      return res.status(400).json({ error: 'Invalid magnet link—no infoHash found' });
    }

    console.log('=== STREMIO STREAM REQUEST ===');
    console.log('🧲 magnetLink:', magnetLink);
    console.log('🎬 movieTitle:', movieTitle || 'N/A');
    console.log('🔑 infoHash:', infoHash);

    // 1) Clean up any existing streams for this user
    if (activeStreams.has(userId)) {
      const existing = activeStreams.get(userId);
      console.log(`🧹 Cleaning up ${existing.length} existing streams for user ${userId}`);
      for (const stream of existing) {
        try {
          await fetch(`${process.env.STREMIO_URL}/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ infoHash: stream.infoHash })
          });
        } catch (cleanupErr) {
          console.warn('Failed to clean up stream:', cleanupErr.message);
        }
      }
      activeStreams.set(userId, []);
    }

    // 2) POST to /:infoHash/create with both trackers (magnet) AND a DHT source
    //    This forces Stremio to enable DHT ⇒ pieces can begin → downloadSpeed > 0
    const createEndpoint = `${process.env.STREMIO_URL}/${infoHash}/create`;
    console.log('📡 Adding torrent to Stremio via:', createEndpoint);

    // Payload:
    //   • infoHash (40-char hex)
    //   • sources: [ magnetLink, `dht:${infoHash}` ]
    //     – including `dht:<hash>` ensures DHT is used (fixes opts.dht:false)
    const payload = {
      infoHash,
      sources: [
        magnetLink,
        `dht:${infoHash}`
      ]
    };

    const stremioResp = await fetch(createEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('📊 Stremio create status:', stremioResp.status);
    const respText = await stremioResp.text();
    console.log('📊 Stremio create response body:', respText);

    if (!stremioResp.ok) {
      console.error('❌ Stremio create error:', respText);
      throw new Error(`Stremio responded with ${stremioResp.status}: ${respText}`);
    }

    // 3) Parse the JSON to find which file index is the “main video” (largest .mkv/.mp4)
    let filesArray = [];
    try {
      // If Stremio returned a JSON object with "files" array, parse it
      const parsed = JSON.parse(respText);
      filesArray = Array.isArray(parsed.files) ? parsed.files : [];
    } catch (ignore) {
      // If parsing fails, assume single‐file torrent and default index 0
      filesArray = [];
    }

    // Pick the largest .mp4/.mkv; fallback to index 0 if none found
    const mainFileIndex = filesArray
      .map((f, i) => ({ ...f, idx: i }))
      .filter(f => /\.(mkv|mp4|avi)$/i.test(f.name))
      .sort((a, b) => b.length - a.length)[0]?.idx ?? 0;

    console.log('📁 Chosen fileIndex:', mainFileIndex);

    console.log('✅ Torrent added to Stremio successfully');

    // 4) Wait longer (10 s) so metadata & piece retrieval can start behind VPN
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 5) Build the proxied stream URL for the client:
    //    http://<host>/stream/<infoHash>?token=<JWT>
    const protocol = req.protocol;    // usually "http"
    const host = req.get('host');     // "localhost:3001" or real domain:port
    const streamUrl = `${protocol}://${host}/stream/${infoHash}`;

    // 6) Save active stream info so we know fileIndex later
    activeStreams.set(userId, [{
      infoHash,
      fileIndex: mainFileIndex,
      movieTitle: movieTitle || null,
      startedAt: new Date(),
      magnetLink,
      streamUrl,
      needsTranscoding: true
    }]);

    // 7) Respond to client
    res.json({
      streamUrl,
      infoHash,
      movieTitle: movieTitle || null,
      message: 'Stream initialization triggered—poll metadata for progress',
      streamingType: 'stremio_hls',
      needsTranscoding: true
    });

  } catch (error) {
    console.error('=== STREMIO STREAM ERROR ===');
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: 'Failed to start stream via Stremio: ' + error.message,
      suggestion: 'Ensure Stremio is running, UDP outbound allowed, and magnet is well seeded'
    });
  }
});

// -----------------------------------------------------------------------------
// Stream Metadata Endpoint (Progress Info, returns “downloading” or “ready”)
// -----------------------------------------------------------------------------

// GET /api/streams/:infoHash/metadata  (authenticated)
app.get('/api/streams/:infoHash/metadata', authenticateToken, async (req, res) => {
  try {
    const { infoHash } = req.params;
    console.log(`📊 Metadata request for infoHash: ${infoHash}`);

    // 1) Query torrent‐level stats: /:infoHash/stats.json
    const rootStatsURL = `${process.env.STREMIO_URL}/${infoHash}/stats.json`;
    const rootRes = await fetch(rootStatsURL);
    if (!rootRes.ok) {
      throw new Error(`Root stats fetch failed (${rootRes.status})`);
    }
    const rootJson = await rootRes.json(); // might be {} initially

    // If rootJson.progress exists, we have at least torrent metadata
    if (typeof rootJson.progress === 'number') {
      const progress = rootJson.progress;
      const isReady = progress > 5; // Stremio can start HLS > ~5%
      return res.json({
        infoHash,
        transcoding: progress < 100,
        transcodingProgress: `${progress.toFixed(1)}%`,
        fileReady: isReady,
        status: isReady ? 'ready' : 'downloading',
        stremioStats: rootJson
      });
    }

    // 2) Otherwise, try file‐level stats on the chosen fileIndex (might not exist yet)
    //    Find the saved fileIndex for this user/infoHash
    const userStreams = activeStreams.get(req.user.userId) || [];
    const thisStream = userStreams.find(s => s.infoHash === infoHash);
    const fileIndex = thisStream?.fileIndex ?? 0;

    const fileStatsURL = `${process.env.STREMIO_URL}/${infoHash}/${fileIndex}/stats.json`;
    const fileRes = await fetch(fileStatsURL);
    if (fileRes.ok) {
      const fileJson = await fileRes.json(); // might be {}
      if (typeof fileJson.progress === 'number') {
        const progress = fileJson.progress;
        const isReady = progress > 5;
        return res.json({
          infoHash,
          transcoding: progress < 100,
          transcodingProgress: `${progress.toFixed(1)}%`,
          fileReady: isReady,
          status: isReady ? 'ready' : 'downloading',
          stremioStats: fileJson
        });
      }
    }

    // 3) Still nothing → metadata not fetched yet
    return res.json({
      status: 'not_found',
      transcoding: false,
      fileReady: false
    });

  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: 'Failed to get metadata' });
  }
});

// -----------------------------------------------------------------------------
// HLS Proxy Endpoint (Streams the chosen fileIndex via /<infoHash>/<fileIndex>/hls.m3u8)
// -----------------------------------------------------------------------------

// GET /stream/:infoHash  (client must send JWT either in query or Authorization)
app.get('/stream/:infoHash', async (req, res) => {
  try {
    const { infoHash } = req.params;

    // 1) Validate token (either in ?token= or Bearer header)
    const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // 2) Figure out which fileIndex we saved for this infoHash (fallback to 0)
    const userStreams = activeStreams.get(decoded.userId) || [];
    const thisStream = userStreams.find(s => s.infoHash === infoHash);
    const fileIndex = thisStream?.fileIndex ?? 0;

    // 3) Build the Stremio HLS URL: /<infoHash>/<fileIndex>/hls.m3u8
    const stremioHlsUrl = `${process.env.STREMIO_URL}/${infoHash}/${fileIndex}/hls.m3u8`;
    console.log(`🎬 Proxying HLS request for ${infoHash}, fileIndex ${fileIndex} → ${stremioHlsUrl}`);

    const stremioResponse = await fetch(stremioHlsUrl, {
      headers: {
        'Range': req.headers.range || 'bytes=0-',
        'User-Agent': 'Streaming-Platform/1.0'
      }
    });

    if (!stremioResponse.ok) {
      console.error(`❌ Stremio HLS responded with ${stremioResponse.status}`);
      throw new Error(`Stremio responded with ${stremioResponse.status}`);
    }

    // 4) Forward headers & pipe
    const contentType = stremioResponse.headers.get('content-type');
    if (contentType && contentType.includes('application/vnd.apple.mpegurl')) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
    } else {
      res.set('Content-Type', contentType || 'video/mp2t');
    }
    res.set('Accept-Ranges', 'bytes');
    const contentLength = stremioResponse.headers.get('content-length');
    if (contentLength) res.set('Content-Length', contentLength);
    const contentRange = stremioResponse.headers.get('content-range');
    if (contentRange) {
      res.set('Content-Range', contentRange);
      res.status(206);
    }
    stremioResponse.body.pipe(res);

  } catch (error) {
    console.error('Stream proxy error:', error);
    res.status(500).json({
      error: 'Stream not available',
      details: error.message
    });
  }
});

// -----------------------------------------------------------------------------
// Stop / Cleanup a Stream
// -----------------------------------------------------------------------------

// DELETE /api/streams/:infoHash  (authenticated)
app.delete('/api/streams/:infoHash', authenticateToken, async (req, res) => {
  try {
    const { infoHash } = req.params;
    const userId = req.user.userId;

    console.log(`🗑️ Cleaning up stream: ${infoHash}`);

    // 1) Tell Stremio to remove the torrent
    await fetch(`${process.env.STREMIO_URL}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ infoHash })
    });

    // 2) Remove from our in‐memory map
    if (activeStreams.has(userId)) {
      const updated = activeStreams.get(userId).filter(s => s.infoHash !== infoHash);
      activeStreams.set(userId, updated);
    }

    res.json({ message: 'Stream stopped' });
  } catch (error) {
    console.error('Stop stream error:', error);
    res.status(500).json({ error: 'Failed to stop stream' });
  }
});

// -----------------------------------------------------------------------------
// Health Check Endpoint
// -----------------------------------------------------------------------------

// GET /api/health  → { status: 'ok', services: { jackett:…, stremio:… } }
app.get('/api/health', async (req, res) => {
  try {
    // Ping Jackett
    const jackettPingUrl = `${process.env.JACKETT_URL}/api/v2.0/indexers`;
    const jackettOK = await fetch(jackettPingUrl, {
      timeout: 5000,
      headers: {
        'Authorization': 'Basic ' +
          Buffer.from(`torrentSite:${process.env.JACKETT_API_KEY}`).toString('base64')
      }
    }).then(r => r.ok).catch(() => false);

    // Ping Stremio (root stats.json returns {} if no streams)
    const stremioPingUrl = `${process.env.STREMIO_URL}/stats.json`;
    const stremioOK = await fetch(stremioPingUrl, { timeout: 5000 })
      .then(r => r.ok).catch(() => false);

    res.json({
      status: 'ok',
      timestamp: new Date(),
      services: {
        jackett: {
          url: process.env.JACKETT_URL,
          accessible: jackettOK
        },
        stremio: {
          url: process.env.STREMIO_URL,
          accessible: stremioOK
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// -----------------------------------------------------------------------------
// Start the Express Server
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`🔍 Jackett URL: ${process.env.JACKETT_URL}`);
  console.log(`🎬 Stremio URL: ${process.env.STREMIO_URL}`);
  console.log(`✨ Stremio streaming with automatic transcoding enabled`);
});