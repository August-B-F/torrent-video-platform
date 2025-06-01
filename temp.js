// api/server.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());

// Serve transcoded files with proper headers for seeking
app.use('/transcoded', express.static(path.join(__dirname, 'output'), {
    setHeaders: (res, path) => {
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', 'video/mp4');
    }
}));

// In-memory storage (replace with SQL database later)
const users = new Map();
const activeStreams = new Map();
const transcodingJobs = new Map();
const streamActivity = new Map(); // Track last activity per stream
const streamMetrics = new Map(); // Track stream performance metrics

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

const cleanupStream = async (infoHash, reason = 'cleanup') => {
    console.log(`🧹 Cleaning up stream ${infoHash} - Reason: ${reason}`);

    // Stop transcoding if running
    if (transcodingJobs.has(infoHash)) {
        const ffmpegProcess = transcodingJobs.get(infoHash);
        ffmpegProcess.kill('SIGTERM');
        transcodingJobs.delete(infoHash);
    }

    // Remove duration info
    transcodingJobs.delete(`${infoHash}_duration`);

    // Remove from Peerflix
    try {
        await fetch(`${process.env.PEERFLIX_URL}/torrents/${infoHash}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.warn(`⚠️ Failed to remove torrent from Peerflix: ${error.message}`);
    }

    // Remove from tracking
    streamActivity.delete(infoHash);
    streamMetrics.delete(infoHash);

    // Remove from user's active streams
    for (const [userId, streams] of activeStreams.entries()) {
        const filteredStreams = streams.filter(s => s.infoHash !== infoHash);
        activeStreams.set(userId, filteredStreams);
    }

    console.log(`✅ Stream ${infoHash} cleaned up successfully`);
};

// Improved transcoding function with better MP4 streaming support
const startTranscoding = async (inputUrl, outputPath, infoHash, onProgress) => {
    return new Promise(async (resolve, reject) => {
        console.log(`🔄 Starting transcoding: ${inputUrl} -> ${outputPath}`);

        const startTime = Date.now();
        let lastProgressTime = Date.now();

        // Set up timeout for metadata loading (1 minute)
        const metadataTimeout = setTimeout(() => {
            console.log(`⏰ Metadata timeout for ${infoHash}`);
            cleanupStream(infoHash, 'metadata_timeout');
            reject(new Error('Metadata loading timeout'));
        }, 60000);

        try {
            // Get the full video duration first
            console.log('📏 Getting video duration...');
            const fullDuration = await getVideoDuration(inputUrl);
            console.log(`📏 Full video duration: ${fullDuration} seconds (${Math.floor(fullDuration / 60)}:${Math.floor(fullDuration % 60).toString().padStart(2, '0')})`);

            clearTimeout(metadataTimeout);
            transcodingJobs.set(`${infoHash}_duration`, fullDuration);

            // Initialize metrics
            streamMetrics.set(infoHash, {
                startTime,
                fullDuration,
                lastProgress: 0,
                stalled: false
            });

        } catch (error) {
            clearTimeout(metadataTimeout);
            console.warn('⚠️ Could not get video duration:', error.message);
            cleanupStream(infoHash, 'duration_fetch_failed');
            reject(error);
            return;
        }

        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const ffmpegArgs = [
            '-i', inputUrl,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-crf', '23',
            '-c:a', 'aac',
            '-ac', '2',
            '-ar', '44100',
            '-b:a', '128k',
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov+faststart',
            '-avoid_negative_ts', 'make_zero',
            '-fflags', '+genpts',
            '-max_muxing_queue_size', '1024',
            '-threads', '0',
            '-y',
            outputPath
        ];

        console.log('🎬 FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));

        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        transcodingJobs.set(infoHash, ffmpeg);

        let stderr = '';
        let hasStarted = false;
        let progressStallCount = 0;

        // Set up progress monitoring
        const progressMonitor = setInterval(() => {
            const metrics = streamMetrics.get(infoHash);
            if (metrics) {
                const now = Date.now();
                const timeSinceProgress = now - lastProgressTime;

                // If no progress for 2 minutes, consider it stalled
                if (timeSinceProgress > 120000) {
                    progressStallCount++;
                    console.log(`⚠️ Transcoding stalled for ${infoHash} (${progressStallCount}/3)`);

                    if (progressStallCount >= 3) {
                        console.log(`❌ Transcoding permanently stalled for ${infoHash}`);
                        cleanupStream(infoHash, 'transcoding_stalled');
                        clearInterval(progressMonitor);
                        reject(new Error('Transcoding stalled'));
                        return;
                    }
                }
            }
        }, 30000);

        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();

            // Parse progress from FFmpeg output
            const timeMatch = stderr.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
            if (timeMatch) {
                lastProgressTime = Date.now();
                progressStallCount = 0; // Reset stall counter

                if (onProgress) {
                    onProgress(timeMatch[1]);
                }

                // Update metrics
                const metrics = streamMetrics.get(infoHash);
                if (metrics) {
                    const timeStr = timeMatch[1];
                    const [hours, minutes, seconds] = timeStr.split(':').map(parseFloat);
                    const currentSeconds = hours * 3600 + minutes * 60 + seconds;
                    metrics.lastProgress = currentSeconds;
                    metrics.stalled = false;
                }
            }

            if (!hasStarted && stderr.includes('frame=')) {
                hasStarted = true;
                console.log('✅ FFmpeg encoding started');
            }
        });

        ffmpeg.on('error', (error) => {
            console.error('❌ FFmpeg spawn error:', error);
            clearInterval(progressMonitor);
            cleanupStream(infoHash, 'ffmpeg_error');
            reject(error);
        });

        ffmpeg.on('close', (code) => {
            clearInterval(progressMonitor);
            console.log(`🏁 FFmpeg finished with code ${code}`);

            if (code === 0) {
                resolve(outputPath);
            } else {
                console.error('❌ FFmpeg stderr:', stderr);
                cleanupStream(infoHash, 'ffmpeg_failed');
                reject(new Error(`FFmpeg failed with code ${code}`));
            }
        });

        setTimeout(() => {
            if (!ffmpeg.killed && hasStarted) {
                console.log('🚀 Transcoding started, progressive streaming enabled...');
                resolve(outputPath);
            } else if (!ffmpeg.killed) {
                setTimeout(() => {
                    if (!ffmpeg.killed) {
                        resolve(outputPath);
                    }
                }, 3000);
            }
        }, 5000);
    });
};

const updateStreamActivity = (infoHash, activityType = 'access') => {
    streamActivity.set(infoHash, {
        lastActivity: Date.now(),
        type: activityType
    });
};

app.post('/api/streams/:infoHash/activity', authenticateToken, (req, res) => {
    const { infoHash } = req.params;
    const { type = 'playing' } = req.body;

    updateStreamActivity(infoHash, type);
    res.json({ success: true });
});

// Direct streaming endpoint for transcoded files with Range support
app.get('/stream/:infoHash', (req, res) => {
    try {
        const { infoHash } = req.params;

        // Update activity
        updateStreamActivity(infoHash, 'streaming');

        // Rest of the existing streaming code...
        const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid token' });
            }

            const outputDir = path.resolve(__dirname, 'output');

            if (!fs.existsSync(outputDir)) {
                return res.status(404).json({ error: 'Output directory not found' });
            }

            const hashPrefix = infoHash.substring(0, 8);
            const files = fs.readdirSync(outputDir).filter(f => f.startsWith(hashPrefix));

            if (files.length === 0) {
                const isTranscoding = transcodingJobs.has(infoHash);
                return res.status(404).json({
                    error: 'Transcoded file not found',
                    isTranscoding,
                    message: isTranscoding ? 'File is still being transcoded' : 'File not available'
                });
            }

            const filePath = path.join(outputDir, files[0]);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found on filesystem' });
            }

            const stat = fs.statSync(filePath);
            const fileSize = stat.size;
            const range = req.headers.range;

            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'no-cache');

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;

                res.status(206);
                res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
                res.setHeader('Content-Length', chunksize);

                const stream = fs.createReadStream(filePath, { start, end });
                stream.pipe(res);
            } else {
                res.setHeader('Content-Length', fileSize);
                const stream = fs.createReadStream(filePath);
                stream.pipe(res);
            }
        });

    } catch (error) {
        console.error('❌ Stream error:', error);
        res.status(500).json({ error: 'Stream failed' });
    }
});

// Check if file needs transcoding
const needsTranscoding = (filename) => {
    const browserCompatible = ['.mp4', '.webm'];  // Removed .ogg as it's not as reliable
    const extension = path.extname(filename.toLowerCase());
    return !browserCompatible.includes(extension);
};

// Generate transcoded filename
const getTranscodedPath = (originalName, infoHash) => {
    const baseName = path.basename(originalName, path.extname(originalName));
    const safeName = baseName.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50);

    // Use absolute path instead of relative
    const outputPath = path.resolve(__dirname, 'output', `${infoHash.substring(0, 8)}_${safeName}.mp4`);

    console.log(`📁 Generated absolute transcoded path: ${outputPath}`);

    return outputPath;
};

// Helper function to wait for torrent metadata
const waitForTorrentMetadata = async (infoHash, maxAttempts = 8, initialWait = 8000) => {
    console.log(`⏳ Waiting for torrent metadata for ${infoHash}...`);

    await new Promise(resolve => setTimeout(resolve, initialWait));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔍 Attempt ${attempt}/${maxAttempts} to fetch torrent details...`);

        try {
            const response = await fetch(`${process.env.PEERFLIX_URL}/torrents/${infoHash}`);

            if (!response.ok) {
                console.log(`❌ HTTP ${response.status} when fetching torrent details`);
                if (attempt === maxAttempts) {
                    throw new Error(`Failed to get torrent details after ${maxAttempts} attempts: HTTP ${response.status}`);
                }
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            const torrentData = await response.json();

            console.log(`📊 Attempt ${attempt} - Torrent data:`, {
                name: torrentData.name || 'undefined',
                hasFiles: !!torrentData.files,
                filesCount: torrentData.files?.length || 0,
                progress: torrentData.progress || 'undefined',
                downloadSpeed: torrentData.downloadSpeed || 'undefined',
                status: torrentData.status || 'undefined',
                peers: torrentData.peers || 'undefined'
            });

            if (torrentData.files && Array.isArray(torrentData.files) && torrentData.files.length > 0) {
                console.log(`✅ Torrent metadata ready after ${attempt} attempts`);
                return torrentData;
            }

            if (attempt === maxAttempts) {
                console.log('❌ Final attempt - Full torrent data:', JSON.stringify(torrentData, null, 2));

                if (torrentData.infoHash) {
                    throw new Error(`Torrent found but no files available. This could mean: 1) Torrent is still connecting to peers, 2) Invalid torrent, 3) All files are non-video files. Try again in a few minutes.`);
                } else {
                    throw new Error(`Torrent not found in Peerflix. The magnet link may be invalid or Peerflix failed to add it.`);
                }
            }

            const waitTime = Math.min(5000 + (attempt * 2000), 15000);
            console.log(`⏳ Files not ready yet, waiting ${waitTime / 1000}s before attempt ${attempt + 1}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));

        } catch (fetchError) {
            console.error(`❌ Error on attempt ${attempt}:`, fetchError.message);
            if (attempt === maxAttempts) {
                throw fetchError;
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

const getVideoDuration = (inputUrl) => {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            inputUrl
        ]);

        let stdout = '';
        let stderr = '';

        ffprobe.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code === 0) {
                try {
                    const metadata = JSON.parse(stdout);
                    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
                    const duration = parseFloat(metadata.format.duration || videoStream?.duration || 0);
                    resolve(duration);
                } catch (error) {
                    reject(new Error('Failed to parse video metadata'));
                }
            } else {
                reject(new Error(`FFprobe failed: ${stderr}`));
            }
        });

        ffprobe.on('error', (error) => {
            reject(error);
        });
    });
};

// Auth endpoints
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

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
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = users.get(username);

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, username }, process.env.JWT_SECRET);
        res.json({ token, user: { id: user.id, username } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Movie search via Jackett
app.get('/api/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;
        const jackettUrl = `${process.env.JACKETT_URL}/api/v2.0/indexers/all/results`;
        const params = new URLSearchParams({
            apikey: process.env.JACKETT_API_KEY,
            Query: query
        });

        const response = await fetch(`${jackettUrl}?${params}`, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from('torrentSite:Jpf24OFa1U14faPOJf14Joa').toString('base64')
            }
        });

        if (!response.ok) {
            throw new Error('Jackett request failed');
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Start streaming with improved transcoding
// Start streaming with improved transcoding
app.post('/api/stream', authenticateToken, async (req, res) => {
    try {
        const { magnetLink, movieTitle } = req.body;
        const userId = req.user.userId;

        console.log('=== STREAM REQUEST ===');
        console.log('🧲 magnetLink:', magnetLink);
        console.log('🎬 movieTitle:', movieTitle);

        // Clean up user's existing streams first
        if (activeStreams.has(userId)) {
            const existingStreams = activeStreams.get(userId);
            console.log(`🧹 Cleaning up ${existingStreams.length} existing streams for user`);

            for (const stream of existingStreams) {
                await cleanupStream(stream.infoHash, 'user_switched');
            }
            activeStreams.set(userId, []);
        }

        if (!magnetLink || !magnetLink.startsWith('magnet:?xt=urn:btih:')) {
            throw new Error(`Invalid magnet link format`);
        }

        console.log('📡 Sending request to Peerflix...');
        const peerflixResponse = await fetch(`${process.env.PEERFLIX_URL}/torrents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link: magnetLink })
        });

        if (!peerflixResponse.ok) {
            const errorText = await peerflixResponse.text();
            console.error('❌ Peerflix error response:', errorText);
            throw new Error(`Peerflix responded with ${peerflixResponse.status}: ${errorText}`);
        }

        const peerflixData = await peerflixResponse.json();
        const { infoHash } = peerflixData;

        if (!infoHash) {
            console.error('❌ Peerflix response:', peerflixData);
            throw new Error('No infoHash returned from Peerflix');
        }

        console.log(`✅ Torrent added to Peerflix with infoHash: ${infoHash}`);

        // Initialize activity tracking
        updateStreamActivity(infoHash, 'initiated');

        const torrentData = await waitForTorrentMetadata(infoHash);

        const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg'];
        const videoFiles = torrentData.files.filter(file =>
            videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
        );

        if (videoFiles.length === 0) {
            await cleanupStream(infoHash, 'no_video_files');
            throw new Error('No video files found in torrent');
        }

        const largestVideo = videoFiles.reduce((largest, current) =>
            current.length > largest.length ? current : largest
        );

        const originalStreamUrl = `${process.env.PEERFLIX_URL}${largestVideo.link}`;
        let finalStreamUrl = originalStreamUrl;
        let transcodingInfo = null;
        let videoDuration = null;

        if (needsTranscoding(largestVideo.name)) {
            console.log('🔄 File needs transcoding, starting FFmpeg...');

            const transcodedPath = getTranscodedPath(largestVideo.name, infoHash);
            const transcodedUrl = `https://188-245-179-212.nip.io/stream/${infoHash}`;

            transcodingInfo = {
                originalFormat: path.extname(largestVideo.name),
                targetFormat: '.mp4',
                status: 'starting',
                progress: '0%'
            };

            try {
                videoDuration = await getVideoDuration(originalStreamUrl);
            } catch (error) {
                console.warn('⚠️ Could not get video duration for response:', error.message);
            }

            startTranscoding(
                originalStreamUrl,
                transcodedPath,
                infoHash,
                (progress) => {
                    console.log(`📊 Transcoding progress: ${progress}`);
                }
            ).then(() => {
                console.log('✅ Transcoding ready for progressive streaming');
            }).catch((error) => {
                console.error('❌ Transcoding failed:', error);
            });

            finalStreamUrl = transcodedUrl;
            transcodingInfo.status = 'transcoding';
        }

        activeStreams.set(userId, [{
            infoHash,
            movieTitle,
            startedAt: new Date(),
            magnetLink,
            fileName: largestVideo.name,
            fileSize: largestVideo.length,
            originalUrl: originalStreamUrl,
            streamUrl: finalStreamUrl,
            needsTranscoding: needsTranscoding(largestVideo.name)
        }]);

        const response = {
            streamUrl: finalStreamUrl,
            originalUrl: originalStreamUrl,
            infoHash,
            fileName: largestVideo.name,
            fileSize: largestVideo.length,
            fileSizeGB: (largestVideo.length / 1024 / 1024 / 1024).toFixed(2),
            format: path.extname(largestVideo.name),
            needsTranscoding: needsTranscoding(largestVideo.name),
            message: transcodingInfo ?
                'Transcoding to MP4 with progressive streaming support. Video will be available shortly.' :
                'Stream ready - no transcoding required',
            streamingType: 'progressive_mp4',
            fullDuration: videoDuration,
            estimatedSize: videoDuration && largestVideo.length ?
                Math.round((largestVideo.length / 1024 / 1024) * 0.7) : null // Estimate ~70% of original size
        };

        if (transcodingInfo) {
            response.transcoding = transcodingInfo;
        }

        console.log('📤 Sending response');
        res.json(response);

    } catch (error) {
        console.error('=== STREAM ERROR ===');
        console.error('❌ Error:', error.message);

        res.status(500).json({
            error: 'Failed to start stream: ' + error.message,
            suggestion: error.message.includes('Torrent found but no files') ?
                'Try again in 2-3 minutes. Some torrents need more time to connect to peers.' :
                'Check if the magnet link is valid and Peerflix service is running.'
        });
    }
});


app.get('/api/streams/:infoHash/metadata', authenticateToken, (req, res) => {
    const { infoHash } = req.params;

    // Check if we have stored duration
    const fullDuration = transcodingJobs.get(`${infoHash}_duration`);

    // Check transcoding status
    const isTranscoding = transcodingJobs.has(infoHash);

    // Check if transcoded file exists
    const outputDir = path.join(__dirname, 'output');
    let fileExists = false;
    let fileSize = 0;

    try {
        const files = fs.readdirSync(outputDir).filter(f => f.startsWith(infoHash.substring(0, 8)));
        if (files.length > 0) {
            fileExists = true;
            const filePath = path.join(outputDir, files[0]);
            const stat = fs.statSync(filePath);
            fileSize = stat.size;
        }
    } catch (e) {
        // Directory might not exist yet
    }

    res.json({
        infoHash,
        fullDuration: fullDuration || null,
        transcoding: isTranscoding,
        fileReady: fileExists,
        fileSize,
        status: isTranscoding ? 'transcoding' : (fileExists ? 'ready' : 'pending')
    });
});

// Get transcoding status
app.get('/api/streams/:infoHash/status', authenticateToken, (req, res) => {
    const { infoHash } = req.params;
    const isTranscoding = transcodingJobs.has(infoHash);

    // Check if transcoded file exists
    const outputDir = path.join(__dirname, 'output');
    let fileExists = false;
    try {
        const files = fs.readdirSync(outputDir).filter(f => f.startsWith(infoHash.substring(0, 8)));
        fileExists = files.length > 0;
    } catch (e) {
        // Directory might not exist yet
    }

    res.json({
        infoHash,
        transcoding: isTranscoding,
        fileReady: fileExists,
        status: isTranscoding ? 'transcoding' : (fileExists ? 'ready' : 'pending')
    });
});

// Get user's active streams
app.get('/api/streams', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const streams = activeStreams.get(userId) || [];
    res.json(streams);
});

// Stop a specific stream
app.delete('/api/streams/:infoHash', authenticateToken, async (req, res) => {
    try {
        const { infoHash } = req.params;
        const userId = req.user.userId;

        if (transcodingJobs.has(infoHash)) {
            const ffmpegProcess = transcodingJobs.get(infoHash);
            ffmpegProcess.kill('SIGTERM');
            transcodingJobs.delete(infoHash);
            console.log(`🛑 Stopped transcoding for ${infoHash}`);
        }

        await fetch(`${process.env.PEERFLIX_URL}/torrents/${infoHash}`, {
            method: 'DELETE'
        });

        if (activeStreams.has(userId)) {
            const streams = activeStreams.get(userId).filter(s => s.infoHash !== infoHash);
            activeStreams.set(userId, streams);
        }

        res.json({ message: 'Stream stopped' });
    } catch (error) {
        console.error('Stop stream error:', error);
        res.status(500).json({ error: 'Failed to stop stream' });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const jackettTest = await fetch(`${process.env.JACKETT_URL}/api/v2.0/indexers`, {
            timeout: 5000,
            headers: {
                'Authorization': 'Basic ' + Buffer.from('torrentSite:Jpf24OFa1U14faPOJf14Joa').toString('base64')
            }
        }).then(r => r.ok).catch(() => false);

        const peerflixTest = await fetch(`${process.env.PEERFLIX_URL}/torrents`, {
            timeout: 5000
        }).then(r => r.ok).catch(() => false);

        res.json({
            status: 'ok',
            timestamp: new Date(),
            activeTranscodingJobs: transcodingJobs.size,
            services: {
                jackett: {
                    url: process.env.JACKETT_URL,
                    accessible: jackettTest
                },
                peerflix: {
                    url: process.env.PEERFLIX_URL,
                    accessible: peerflixTest
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            services: {
                jackett: process.env.JACKETT_URL,
                peerflix: process.env.PEERFLIX_URL
            }
        });
    }
});

// Cleanup old streams and transcoding jobs
setInterval(async () => {
    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    const oldThreshold = 2 * 60 * 60 * 1000; // 2 hours

    console.log('🔍 Running smart cleanup check...');

    // Check for inactive streams
    for (const [infoHash, activity] of streamActivity.entries()) {
        const timeSinceActivity = now - activity.lastActivity;

        // If stream is playing but no activity for 10 minutes, clean up
        if (timeSinceActivity > inactiveThreshold) {
            console.log(`🧹 Cleaning up inactive stream: ${infoHash} (inactive for ${Math.round(timeSinceActivity / 60000)} minutes)`);
            await cleanupStream(infoHash, 'inactive');
            continue;
        }
    }

    // Check for old streams without activity tracking
    for (const [userId, streams] of activeStreams.entries()) {
        const activeStreamsFiltered = [];

        for (const stream of streams) {
            const timeSinceStart = now - stream.startedAt.getTime();

            // If stream is very old and no recent activity, clean up
            if (timeSinceStart > oldThreshold && !streamActivity.has(stream.infoHash)) {
                console.log(`🧹 Cleaning up old stream: ${stream.infoHash}`);
                await cleanupStream(stream.infoHash, 'old');
            } else {
                activeStreamsFiltered.push(stream);
            }
        }

        activeStreams.set(userId, activeStreamsFiltered);
    }

}, 5 * 60 * 1000); // Check every 5 minutes

const ensureOutputDirectory = () => {
    const outputDir = path.resolve(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 Created output directory: ${outputDir}`);
    } else {
        console.log(`📁 Output directory exists: ${outputDir}`);
    }

    try {
        const testFile = path.join(outputDir, 'test.txt');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`✅ Output directory is writable`);
    } catch (error) {
        console.error(`❌ Output directory is not writable:`, error.message);
    }
};

app.listen(PORT, () => {
    console.log(`🚀 API server running on port ${PORT}`);
    console.log(`🔍 Jackett URL: ${process.env.JACKETT_URL}`);
    console.log(`📡 Peerflix URL: ${process.env.PEERFLIX_URL}`);
    console.log(`🎬 Enhanced progressive MP4 streaming enabled`);

    ensureOutputDirectory();
});