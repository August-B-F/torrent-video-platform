// src/components/pages/MediaPlayerPage/MediaPlayerPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReactPlayer from 'react-player/lazy';
import { usePopup } from '../../contexts/PopupContext';
import './MediaPlayerPage.css';

// --- SVG Icons ---
const PlayArrowIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>;
const VolumeUpIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>;
const VolumeOffIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path></svg>;
const FullscreenIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg>;
const FullscreenExitIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"></path></svg>;
const BackToDetailsIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>;
const EpisodesIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 10h-2.5v2.5h-3V12H8V9h2.5V6.5h3V9H16v3z"></path></svg>;
const NextEpisodeIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg>;
const SkipBackwardIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18 18h-2V9.83l-4.59 4.59L10 13l-6-6 1.41-1.41L11 11.17V6h2v9.83l3.59-3.59L18 13l6 6-1.41 1.41L18 15.83V18z" transform="scale(-1, 1) translate(-24, 0)"></path><text x="4" y="19" font-size="8" fill="#fff" font-family="Arial">10</text></svg>;
const SkipForwardIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 18h2V9.83l4.59 4.59L14 13l6-6-1.41-1.41L13 11.17V6h-2v9.83l-3.59-3.59L6 13l-6 6 1.41 1.41L6 15.83V18z"></path><text x="13" y="19" font-size="8" fill="#fff" font-family="Arial">10</text></svg>;


// Helper function to parse size string to MB (copied from ItemDetailPage)
const parseSizeToMB = (sizeStr) => {
  if (!sizeStr || typeof sizeStr !== 'string') return 0;
  const value = parseFloat(sizeStr);
  if (isNaN(value)) return 0;
  if (sizeStr.toUpperCase().includes('GB')) return value * 1024;
  if (sizeStr.toUpperCase().includes('MB')) return value;
  if (sizeStr.toUpperCase().includes('KB')) return value / 1024;
  return 0;
};

// Helper function to score and sort torrents (copied from ItemDetailPage)
const scoreAndSortTorrents = (torrents) => {
  if (!Array.isArray(torrents)) return [];
  const qualityScores = {
    '4k': 5, '2160p': 5, 'uhd': 5, '1080p': 4, 'fhd': 4,
    '720p': 3, 'hd': 3, 'sd': 1, '480p': 1, '360p': 0,
  };
  const releaseTypeScores = {
    'bluray': 5, 'blu-ray': 5, 'bdrip': 5, 'brrip': 5, 'web-dl': 4, 'webdl': 4, 'web': 4,
    'webrip': 3, 'hdrip': 2, 'hdtv': 2, 'dvdrip': 1, 'dvd': 1, 'cam': -10, 'hdcam': -10,
    'telesync': -8, 'ts': -8,
  };
  const codecScores = {
    'av1': 3, 'x265': 2, 'h265': 2, 'hevc': 2, 'x264': 1, 'h264': 1, 'avc': 1,
    'xvid': -1, 'divx': -1,
  };
  return torrents.map(stream => {
    let score = 0;
    const titleLower = stream.title ? stream.title.toLowerCase() : '';
    if ((stream.Seeders || 0) > 0) {
      score += (stream.Seeders || 0) * 5;
      score += (stream.Peers || 0) * 0.5;
    } else {
      if ((stream.Peers || 0) === 0) score = -200;
      else score = -50;
    }
    let qualityFound = false;
    if (stream.quality && stream.quality !== 'N/A') {
      const qualityKey = stream.quality.toLowerCase().replace('p','');
      if (qualityScores[qualityKey]) { score += qualityScores[qualityKey] * 2.5; qualityFound = true; }
    }
    if (!qualityFound) {
      for (const q in qualityScores) if (titleLower.includes(q)) { score += qualityScores[q]; qualityFound = true; break; }
    }
    if (!qualityFound) score -= 1;
    for (const rt in releaseTypeScores) if (titleLower.includes(rt.replace('-', ''))) { score += releaseTypeScores[rt]; break; }
    for (const c in codecScores) if (titleLower.includes(c)) { score += codecScores[c]; break; }
    if (stream.PublishDate) score += 0.2;
    const sizeMB = parseSizeToMB(stream.size);
    if (sizeMB > 0) {
      const q = stream.quality || (titleLower.includes('4k') || titleLower.includes('2160p') ? '4K' : titleLower.includes('1080p') ? '1080p' : titleLower.includes('720p') ? '720p' : 'SD');
      if (q === '4K') { if (sizeMB < 1500) score -=5; else if (sizeMB > 5000) score +=2; }
      else if (q === '1080p') { if (sizeMB < 600) score -=3; else if (sizeMB > 1500 && sizeMB < 20000) score +=1.5; }
      else if (q === '720p') { if (sizeMB < 250) score -=2; else if (sizeMB > 700 && sizeMB < 10000) score += 0.5; }
    } else score -= 0.5;
    if (titleLower.includes('bad') || titleLower.includes('poor') || titleLower.includes("wrong")) score -= 7;
    if (titleLower.includes('subbed') && !titleLower.includes('multi')) score -= 0.5;
    if (titleLower.includes('dubbed')) score -= 1;
    if (titleLower.includes('repack') || titleLower.includes('proper')) score += 1;
    return { ...stream, score };
  }).sort((a, b) => b.score - a.score);
};

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === Infinity || seconds === null) { return '00:00'; }
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh) { return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`; }
    return `${mm}:${ss}`;
};
const today = new Date().toISOString().split('T')[0];

const MediaPlayerPage = () => {
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const hlsRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const episodePanelRef = useRef(null);

  const [streamUrl, setStreamUrl] = useState('');
  const [playerDisplayTitle, setPlayerDisplayTitle] = useState('Loading...');
  const [streamType, setStreamType] = useState('direct');
  const [originalItemId, setOriginalItemId] = useState(null);
  const [originalItemType, setOriginalItemType] = useState(null);
  
  const [seriesData, setSeriesData] = useState(null);
  const [currentEpisodeData, setCurrentEpisodeData] = useState(null);

  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('playerVolume')) || 0.8);
  const [muted, setMuted] = useState(() => localStorage.getItem('playerMuted') === 'true' || false);
  const [played, setPlayed] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isHlsReady, setIsHlsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const [isEpisodePanelOpen, setIsEpisodePanelOpen] = useState(false);
  // Playback rate state is removed
  const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);

  const isHlsStream = useMemo(() => streamType === 'hls' || streamUrl?.endsWith('.m3u8'), [streamType, streamUrl]);
  const navigate = useNavigate();
  const { showPopup } = usePopup();

  useEffect(() => {
    const url = localStorage.getItem('playerStreamUrl');
    const title = localStorage.getItem('playerStreamTitle');
    const type = localStorage.getItem('playerStreamType');
    const storedOriginalItemId = localStorage.getItem('playerItemId');
    const storedOriginalItemType = localStorage.getItem('playerItemType');
    const storedSeriesData = localStorage.getItem('playerSeriesData');
    const storedCurrentEpisodeData = localStorage.getItem('playerCurrentEpisodeData');

    if (url && title) {
      setStreamUrl(url);
      setPlayerDisplayTitle(title);
      setStreamType(type || 'direct');
      setOriginalItemId(storedOriginalItemId);
      setOriginalItemType(storedOriginalItemType);
      if (storedSeriesData) {
        try { setSeriesData(JSON.parse(storedSeriesData)); } catch (e) { console.error("Failed to parse series data", e); }
      }
      if (storedCurrentEpisodeData) {
        try { setCurrentEpisodeData(JSON.parse(storedCurrentEpisodeData)); } catch (e) { console.error("Failed to parse current episode data", e); }
      }
      setIsLoading(true); setError(null); setPlayed(0); setDuration(0);
      setRetryCount(0); setIsHlsReady(false);
    } else {
      setError('Stream information not found. Please try again from the item page.');
      setIsLoading(false);
    }
    return () => { 
        if (hlsRef.current) hlsRef.current.destroy();
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!streamUrl || !isHlsStream || !videoRef.current) return;
    const video = videoRef.current;
    let hls = null;
    const setupHls = async () => {
      try {
        if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = streamUrl; setIsHlsReady(true); return; }
        const Hls = (await import('hls.js')).default;
        if (!Hls.isSupported()) { setError('HLS is not supported.'); return; }
        hls = new Hls({ 
            debug: false, enableWorker: true, lowLatencyMode: false, backBufferLength: 90, maxBufferLength: 30,
            maxMaxBufferLength: 600, maxBufferSize: 60 * 1000 * 1000, maxBufferHole: 0.5,
            highBufferWatchdogPeriod: 2, nudgeOffset: 0.1, nudgeMaxRetry: 3, maxFragLookUpTolerance: 0.25,
            liveSyncDurationCount: 3, liveDurationInfinity: true, levelLoadingTimeOut: 10000,
            manifestLoadingTimeOut: 10000, levelLoadingMaxRetry: 4, manifestLoadingMaxRetry: 4,
            xhrSetup: function(xhr) { xhr.withCredentials = false; }
         });
        hlsRef.current = hls;
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(streamUrl));
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          setIsHlsReady(true); setIsLoading(false);
          if (data.levels && data.levels[0]?.details?.totalduration) setDuration(data.levels[0].details.totalduration);
        });
        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
            if (data.details.totalduration && data.details.totalduration !== Infinity) setDuration(data.details.totalduration);
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
             if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                if (retryCount < 3) {
                  retryTimeoutRef.current = setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                    if(hlsRef.current) hlsRef.current.loadSource(streamUrl);
                  }, 2000 * (retryCount + 1));
                } else { setError('Torrent unavailable or network error.'); setIsLoading(false); }
              } else { setError('Torrent unavailable.'); setIsLoading(false); }
          }
        });
        hls.on(Hls.Events.FRAG_BUFFERED, () => setIsLoading(false));
        hls.on(Hls.Events.BUFFER_APPENDED, () => setIsLoading(false)); 
        hls.on(Hls.Events.BUFFER_EOS, () => setIsLoading(false)); 
        hls.attachMedia(video);
      } catch (err) { setError('Failed to init HLS.'); setIsLoading(false); }
    };
    setupHls();
    return () => { if (hls) hls.destroy(); };
  }, [streamUrl, isHlsStream, retryCount]);

  const { regularSeasons, specialEpisodes } = useMemo(() => {
    if (seriesData && seriesData.videos) {
        const seasons = {}; const specials = [];
        seriesData.videos.forEach(video => {
            const seasonNum = video.season;
            const episodeNum = video.number || video.episode;
            const isReleased = video.released ? new Date(video.released) <= new Date(today) : true;
            const episodeData = { ...video, number: episodeNum, isReleased };
            if (seasonNum && seasonNum > 0) {
                if (!seasons[seasonNum]) seasons[seasonNum] = [];
                seasons[seasonNum].push(episodeData);
            } else { specials.push(episodeData); }
        });
        Object.keys(seasons).forEach(sn => seasons[sn].sort((a,b) => (a.number||0)-(b.number||0)));
        specials.sort((a,b)=>(a.number||0)-(b.number||0));
        return { regularSeasons: seasons, specialEpisodes: specials };
    }
    return { regularSeasons: {}, specialEpisodes: [] };
  }, [seriesData]);

  const handlePlayPause = useCallback(() => {
    if (error) return;
    if (isHlsStream && videoRef.current) {
        if (playing) videoRef.current.pause();
        else videoRef.current.play().catch(err => setError('Playback failed.'));
    }
    setPlaying(!playing);
  }, [playing, isHlsStream, error]);

  const handleVolumeChange = useCallback((e) => { 
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setMuted(newVolume === 0);
    if (isHlsStream && videoRef.current) videoRef.current.volume = newVolume;
    else if (playerRef.current) playerRef.current.volume = newVolume; // For ReactPlayer
    localStorage.setItem('playerVolume', newVolume.toString());
  }, [isHlsStream]);

  const handleToggleMute = useCallback(() => { 
    const newMuted = !muted;
    setMuted(newMuted);
    if (isHlsStream && videoRef.current) videoRef.current.muted = newMuted;
    else if (playerRef.current) playerRef.current.muted = newMuted; // For ReactPlayer
    if (newMuted && volume === 0) setVolume(0.5);
    localStorage.setItem('playerMuted', newMuted.toString());
  }, [muted, volume, isHlsStream]);
  
  const handleSeek = (amount) => {
    if (error || duration === 0) return;
    let newPlayedTime;
    if (isHlsStream && videoRef.current) {
        newPlayedTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + amount));
        videoRef.current.currentTime = newPlayedTime;
    } else if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime() || 0;
        newPlayedTime = Math.max(0, Math.min(duration, currentTime + amount));
        playerRef.current.seekTo(newPlayedTime);
    }
    if (newPlayedTime !== undefined) setPlayed(newPlayedTime / duration);
  };

  const handleSeekMouseDown = useCallback(() => {!error && setSeeking(true)}, [error]);
  const handleSeekChange = useCallback((e) => {!error && setPlayed(parseFloat(e.target.value))}, [error]);
  const handleSeekMouseUp = useCallback((e) => {
    if (error) return;
    setSeeking(false);
    const seekToTime = parseFloat(e.target.value) * duration;
    if (isHlsStream && videoRef.current) videoRef.current.currentTime = seekToTime;
    else if (playerRef.current) playerRef.current.seekTo(seekToTime);
   }, [isHlsStream, duration, error]);

  const handleProgress = useCallback((state) => {
    if (!seeking && !error) {
      setPlayed(state.played);
      setDuration(state.loadedSeconds > 0 ? state.loadedSeconds : (playerRef.current?.getDuration() || 0));
      if (seriesData && currentEpisodeData && duration > 0 && state.playedSeconds > 0) {
          const remainingTime = duration - state.playedSeconds;
          if (remainingTime < 60 && remainingTime > 0) setShowNextEpisodeButton(true);
          else setShowNextEpisodeButton(false);
      }
    }
  }, [seeking, error, seriesData, currentEpisodeData, duration]);

  const handleTimeUpdate = useCallback(() => {
    if (!seeking && videoRef.current && duration > 0 && !error) {
      const currentTime = videoRef.current.currentTime;
      setPlayed(currentTime / duration);
      if (seriesData && currentEpisodeData && duration > 0 && currentTime > 0) {
        const remainingTime = duration - currentTime;
         if (remainingTime < 60 && remainingTime > 0) setShowNextEpisodeButton(true);
        else setShowNextEpisodeButton(false);
      }
    }
  }, [seeking, duration, error, seriesData, currentEpisodeData]);
  
  const handleDuration = (d) => {
    if (d && d > 0 && !error) {
        setDuration(d);
        setIsLoading(false);
    }
  };
  const handleHlsDurationChange = useCallback(() => {
    if (videoRef.current && videoRef.current.duration && isFinite(videoRef.current.duration) && !error) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  }, [error]);

    const handleEpisodeSelectInPanel = async (episode) => {
    if (!episode.isReleased) {
        showPopup("This episode has not aired yet.", "info");
        return;
    }
    setIsLoading(true); setError(null); setPlayed(0); setDuration(0);
    setRetryCount(0); setIsHlsReady(false); setShowNextEpisodeButton(false);
    
    const seasonNum = episode.season;
    const episodeNum = episode.number || episode.episode;
    const sPad = String(seasonNum).padStart(2,'0'); 
    const ePad = String(episodeNum).padStart(2,'0');
    const query = `${seriesData.name.replace(/[:\-–()']/g, '').replace(/\s+/g, ' ').trim()} S${sPad}E${ePad}`;
    
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error("Authentication required.");
        showPopup("Fetching sources for new episode...", "info", 5000);
        const searchResponse = await fetch(`http://188-245-179-212.nip.io/api/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!searchResponse.ok) throw new Error(`Failed to find sources (HTTP ${searchResponse.status})`);
        const searchData = await searchResponse.json();
        if (!searchData.Results || searchData.Results.length === 0) {
            throw new Error("No sources found for this episode.");
        }
        const formattedStreams = searchData.Results.map(stream => ({
            title: stream.Title, name: `${stream.Tracker || stream.Site || 'N/A'} (${stream.Seeders||0}S/${stream.Peers||0}P)`,
            quality: stream.Title?.match(/4k|2160p/i) ? '4K' : stream.Title?.match(/1080p/i) ? '1080p' : stream.Title?.match(/720p/i) ? '720p' : 'SD',
            magnetLink: stream.MagnetUri || stream.Link,
            Seeders: stream.Seeders || 0, Peers: stream.Peers || 0,
            size: stream.Size, PublishDate: stream.PublishDate,
        }));
        const bestStream = scoreAndSortTorrents(formattedStreams)[0];
        if (!bestStream || !bestStream.magnetLink) throw new Error("No suitable magnet link found for this episode.");
        const streamResponse = await fetch('http://188-245-179-212.nip.io/api/stream', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ magnetLink: bestStream.magnetLink, movieTitle: `${seriesData.name} S${sPad}E${ePad}` })
        });
        const streamData = await streamResponse.json();
        if (!streamResponse.ok || !streamData.streamUrl) throw new Error(streamData.error || "Failed to start stream for episode.");
        let publicStreamUrl = streamData.streamUrl;
        if (streamData.streamType !== 'hls' && publicStreamUrl.includes('172.17.0.1:9000')) {
          publicStreamUrl = publicStreamUrl.replace('http://172.17.0.1:9000', 'http://188-245-179-212.nip.io/admin/peerflix');
        }
        setStreamUrl(publicStreamUrl);
        setPlayerDisplayTitle(`${seriesData.name} - S${sPad}E${ePad} - ${episode.title || `Episode ${ePad}`}`);
        setStreamType(streamData.streamType || 'direct');
        setCurrentEpisodeData(episode);
        localStorage.setItem('playerStreamUrl', publicStreamUrl);
        localStorage.setItem('playerStreamTitle', `${seriesData.name} - S${sPad}E${ePad} - ${episode.title || `Episode ${ePad}`}`);
        localStorage.setItem('playerStreamType', streamData.streamType || 'direct');
        localStorage.setItem('playerCurrentEpisodeData', JSON.stringify(episode));
        setIsEpisodePanelOpen(false);
        setPlaying(true);
    } catch (err) {
        console.error("Error switching episode:", err);
        setError(`Failed to switch episode: ${err.message}`);
        setIsLoading(false);
    }
  };

  const playNextEpisode = useCallback(() => {
    if (!seriesData || !currentEpisodeData || !regularSeasons) return;
    const currentSeasonNum = currentEpisodeData.season;
    const currentEpisodeNum = currentEpisodeData.number || currentEpisodeData.episode;
    let nextEpisode = null;
    const currentSeasonEpisodes = regularSeasons[currentSeasonNum];
    if (currentSeasonEpisodes) {
        const currentIndexInSeason = currentSeasonEpisodes.findIndex(ep => ep.number === currentEpisodeNum || ep.episode === currentEpisodeNum);
        if (currentIndexInSeason !== -1 && currentIndexInSeason < currentSeasonEpisodes.length - 1) {
            nextEpisode = currentSeasonEpisodes[currentIndexInSeason + 1];
        }
    }
    if (!nextEpisode) {
        const seasonNumbers = Object.keys(regularSeasons).map(Number).sort((a, b) => a - b);
        const currentSeasonIndex = seasonNumbers.indexOf(currentSeasonNum);
        if (currentSeasonIndex !== -1 && currentSeasonIndex < seasonNumbers.length - 1) {
            const nextSeasonNum = seasonNumbers[currentSeasonIndex + 1];
            if (regularSeasons[nextSeasonNum] && regularSeasons[nextSeasonNum].length > 0) {
                nextEpisode = regularSeasons[nextSeasonNum][0];
            }
        }
    }
    if (nextEpisode && nextEpisode.isReleased) {
        handleEpisodeSelectInPanel(nextEpisode);
        setShowNextEpisodeButton(false);
    } else if (nextEpisode && !nextEpisode.isReleased) {
        showPopup("Next episode has not aired yet.", "info");
        setShowNextEpisodeButton(false);
    } else {
        showPopup("You've reached the end of the series!", "info");
        setShowNextEpisodeButton(false);
    }
  }, [seriesData, currentEpisodeData, regularSeasons, showPopup, handleEpisodeSelectInPanel]); // Added dependencies

  const handleEnded = useCallback(() => {
    if (seriesData && currentEpisodeData) playNextEpisode();
    else setPlaying(false);
  }, [seriesData, currentEpisodeData, playNextEpisode]);

  const handleFullscreenToggle = useCallback(() => { 
      const elem = playerContainerRef.current;
        if (!elem) return;
        if (!document.fullscreenElement) elem.requestFullscreen?.().catch(err => console.warn("Fs err:",err));
        else document.exitFullscreen?.();
  }, []);
  
  useEffect(() => { 
    const cb = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', cb);
    return () => document.removeEventListener('fullscreenchange', cb);
   }, []);

  const debouncedHideControls = useCallback(() => { 
    if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
        if(playing && !seeking && !isEpisodePanelOpen) setShowControls(false);
    }, 3500);
  }, [playing, seeking, isEpisodePanelOpen]);

  const handleMouseMove = useCallback(() => { 
      setShowControls(true);
      debouncedHideControls();
  }, [debouncedHideControls]);

  useEffect(() => { 
    setShowControls(true);
    debouncedHideControls();
  }, [debouncedHideControls]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (error) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      switch (e.key) {
        case ' ': e.preventDefault(); handlePlayPause(); break;
        case 'f': case 'F': e.preventDefault(); handleFullscreenToggle(); break;
        case 'm': case 'M': e.preventDefault(); handleToggleMute(); break;
        case 'ArrowUp': e.preventDefault(); setVolume(v => Math.min(1, v + 0.1)); break;
        case 'ArrowDown': e.preventDefault(); setVolume(v => Math.max(0, v - 0.1)); break;
        case 'ArrowLeft': e.preventDefault(); handleSeek(-10); break;
        case 'ArrowRight': e.preventDefault(); handleSeek(10); break;
        default: break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleFullscreenToggle, handleToggleMute, handleSeek, error, setVolume]); // Added setVolume to dependencies

  const getBackLink = () => originalItemId && originalItemType ? `/${originalItemType}/${originalItemId}` : "/";

  const [activeSeasonTab, setActiveSeasonTab] = useState(null);
  
  useEffect(() => {
    if (seriesData && currentEpisodeData) {
        setActiveSeasonTab(currentEpisodeData.season || (specialEpisodes.length > 0 && !Object.keys(regularSeasons).length ? "specials" : 1));
    } else if (seriesData && !currentEpisodeData && Object.keys(regularSeasons).length > 0) {
        setActiveSeasonTab(Math.min(...Object.keys(regularSeasons).map(Number)));
    } else if (seriesData && specialEpisodes.length > 0) {
        setActiveSeasonTab("specials");
    }
  }, [seriesData, currentEpisodeData, regularSeasons, specialEpisodes]);

   useEffect(() => {
    const handleClickOutsideEpisodePanel = (event) => {
      if (episodePanelRef.current && !episodePanelRef.current.contains(event.target)) {
        const episodeButton = document.getElementById('episode-panel-toggle-button');
        if (episodeButton && !episodeButton.contains(event.target)) {
          setIsEpisodePanelOpen(false);
        }
      }
    };
    if (isEpisodePanelOpen) document.addEventListener('mousedown', handleClickOutsideEpisodePanel);
    return () => document.removeEventListener('mousedown', handleClickOutsideEpisodePanel);
  }, [isEpisodePanelOpen]);

  if (!streamUrl && !isLoading && error) {
    return (
      <div className="media-player-page error-page">
        <div className="player-error-message full-page-error">
          <p>{error}</p>
          <Link to={getBackLink()} className="player-page-button">Back to Details</Link>
        </div>
      </div>
    );
  }
  if (!streamUrl && isLoading) {
    return (
      <div className="media-player-page loading-page">
        <div className="player-loader-container full-page-loader">
          <div className="player-loader large-spinner"></div>
          <p>Preparing Player...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`media-player-page ${showControls || !playing || isEpisodePanelOpen ? 'show-controls' : ''}`}
         onMouseMove={handleMouseMove}
         onMouseLeave={() => { if (playing && !seeking && !isEpisodePanelOpen) setShowControls(false); }}
         ref={playerContainerRef}
    >
      <div className="player-page-header">
        {originalItemId && originalItemType && (
            <Link to={getBackLink()} className="player-page-button back-button" title="Back to Details">
                <BackToDetailsIcon /> Back
            </Link>
        )}
        <h3 className="player-page-title" title={playerDisplayTitle}>{playerDisplayTitle}</h3>
        <div className="header-actions-right">
             {seriesData && (
                <button 
                    id="episode-panel-toggle-button"
                    onClick={() => setIsEpisodePanelOpen(prev => !prev)} 
                    className={`player-page-button control-button ${isEpisodePanelOpen ? 'active' : ''}`}
                    title="Episodes"
                >
                    <EpisodesIcon />
                </button>
            )}
        </div>
      </div>

      {isEpisodePanelOpen && seriesData && (
        <div className={`episode-browser-panel ${isEpisodePanelOpen ? 'open' : ''}`} ref={episodePanelRef}>
          <div className="episode-browser-header">
            <h4>{seriesData.name} - Episodes</h4>
            <button onClick={() => setIsEpisodePanelOpen(false)} className="close-panel-btn">&times;</button>
          </div>
          <div className="episode-browser-tabs">
            {Object.keys(regularSeasons).sort((a,b) => Number(a) - Number(b)).map(seasonNum => (
              <button key={`season-tab-${seasonNum}`} 
                      className={`season-tab-btn ${activeSeasonTab === Number(seasonNum) ? 'active' : ''}`}
                      onClick={() => setActiveSeasonTab(Number(seasonNum))}>
                Season {seasonNum}
              </button>
            ))}
            {specialEpisodes.length > 0 && (
                <button key="season-tab-specials"
                        className={`season-tab-btn ${activeSeasonTab === "specials" ? 'active' : ''}`}
                        onClick={() => setActiveSeasonTab("specials")}>
                    Specials
                </button>
            )}
          </div>
          <ul className="episode-browser-list">
            {(activeSeasonTab === "specials" ? specialEpisodes : regularSeasons[activeSeasonTab] || []).map(ep => (
              <li key={ep.id || `${ep.season}-${ep.number}`} 
                  className={`episode-list-item ${!ep.isReleased ? 'not-aired' : ''} ${currentEpisodeData?.id === ep.id ? 'playing-now' : ''}`}
                  onClick={() => ep.isReleased ? handleEpisodeSelectInPanel(ep) : null}
                  title={!ep.isReleased ? "Not Aired Yet" : ep.title || `Episode ${ep.number}`}>
                <span className="episode-number">E{ep.number || ep.episode}</span>
                <span className="episode-item-title">{ep.title || 'Episode'}</span>
                {!ep.isReleased && ep.released && <span className="episode-air-date">(Airs: {new Date(ep.released).toLocaleDateString()})</span>}
              </li>
            ))}
             {(activeSeasonTab !== "specials" && (!regularSeasons[activeSeasonTab] || regularSeasons[activeSeasonTab].length === 0)) && <li>No episodes for this season.</li>}
             {(activeSeasonTab === "specials" && specialEpisodes.length === 0) && <li>No special episodes.</li>}
          </ul>
        </div>
      )}

      <div className="player-wrapper-page">
        {isLoading && (
          <div className="player-loader-container page-level-loader">
            <div className="player-loader large-spinner"></div> <p>Loading Stream...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="player-error-message in-player-error">
            <p>{error}</p>
             <button onClick={() => {
                setError(null); setIsLoading(true); setRetryCount(0);
                if (isHlsStream && videoRef.current && hlsRef.current) {
                    hlsRef.current.loadSource(streamUrl);
                } else if (playerRef.current && !isHlsStream) {
                    setStreamUrl(''); setTimeout(() => setStreamUrl(localStorage.getItem('playerStreamUrl')), 50);
                }
             }} className="player-page-button retry-button">Retry</button>
          </div>
        )}

        {!error && isHlsStream ? (
            <video ref={videoRef} className="react-player-page" style={{ width: '100%', height: '100%' }}
              playsInline onClick={handlePlayPause} onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleHlsDurationChange} onLoadedMetadata={handleHlsDurationChange}
              onPlay={() => { setPlaying(true); setIsLoading(false);}}
              onPause={() => setPlaying(false)}
              onWaiting={() => setIsLoading(true)}
              onPlaying={() => setIsLoading(false)}
              onCanPlay={() => setIsLoading(false)}
              onEnded={handleEnded}
              onError={(e) => { if (!error) setError('Video playback error.'); setIsLoading(false);}}
            />
          ) : !error && (
            <ReactPlayer ref={playerRef} url={streamUrl} className="react-player-page"
              playing={playing} controls={false} volume={volume} muted={muted}
              onProgress={handleProgress} onDuration={handleDuration}
              width="100%" height="100%"
              // playbackRate prop removed
              onReady={() => setIsLoading(false)}
              onBuffer={() => setIsLoading(true)}
              onBufferEnd={() => setIsLoading(false)}
              onEnded={handleEnded}
              onError={(e) => { setError('Failed to load video. Torrent might be unavailable or format not supported.'); setIsLoading(false);}}
              config={{ file: { attributes: { controlsList: 'nodownload' }}}}
            />
          )}
      </div>

      <div className="player-page-controls">
        <button onClick={() => handleSeek(-10)} className="player-page-button control-button" title="Seek -10s" disabled={isLoading || duration === 0 || !!error}> <SkipBackwardIcon/> </button>
        <button onClick={handlePlayPause} className="player-page-button control-button" disabled={isLoading || !!error}>
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </button>
        <button onClick={() => handleSeek(10)} className="player-page-button control-button" title="Seek +10s" disabled={isLoading || duration === 0 || !!error}> <SkipForwardIcon/> </button>
        
        <input type="range" min={0} max={0.999999} step="any" value={played}
          onMouseDown={handleSeekMouseDown} onChange={handleSeekChange} onMouseUp={handleSeekMouseUp}
          className="player-page-progress-bar" style={{ backgroundSize: `${played * 100}% 100%` }}
          disabled={isLoading || duration === 0 || !!error}
        />
        
        <div className="player-page-time-display">{formatTime(played * duration)} / {formatTime(duration)}</div>

        {showNextEpisodeButton && seriesData && (
            <button onClick={playNextEpisode} className="player-page-button control-button next-episode-button" title="Play Next Episode">
                <NextEpisodeIcon /> Next
            </button>
        )}

        <div className="player-page-volume-controls">
          <button onClick={handleToggleMute} className="player-page-button control-button">
            {muted || volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </button>
          <input type="range" min={0} max={1} step="any" value={muted ? 0 : volume}
            onChange={handleVolumeChange} className="player-page-volume-slider"
            style={{ backgroundSize: `${(muted ? 0 : volume) * 100}% 100%` }}
          />
        </div>
        {/* Playback speed controls removed */}
        <button onClick={handleFullscreenToggle} className="player-page-button control-button">
          {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </button>
      </div>
    </div>
  );
};

export default MediaPlayerPage;