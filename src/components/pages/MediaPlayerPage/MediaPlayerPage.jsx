import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw, Settings, AlertTriangle, Loader2 } from 'lucide-react';
import './MediaPlayerPage.css';

const MediaPlayerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { streamData: initialStreamData } = location.state || {};

  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const activityIntervalRef = useRef(null);
  const metadataPollIntervalRef = useRef(null);

  const [streamData, setStreamData] = useState(initialStreamData);
  const [isPlaying, setIsPlaying] = useState(true); // Autoplay
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0); // Duration of currently loaded/playable media
  const [fullDuration, setFullDuration] = useState(initialStreamData?.fullDuration || 0); // Total duration of the content
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [buffered, setBuffered] = useState(0); // Percentage
  const [transcodingDetails, setTranscodingDetails] = useState(initialStreamData?.transcoding || null);
  const [apiBaseUrl, setApiBaseUrl] = useState('');


  useEffect(() => {
    // Determine API base URL dynamically or from a config
    // For this example, using the one from temp.js or assuming it's the same origin
    setApiBaseUrl(window.location.origin.includes('localhost') ? 'https://188-245-179-212.nip.io' : window.location.origin);
  }, []);


  const videoSrc = useMemo(() => {
    if (streamData?.streamUrl) {
      if (streamData.streamUrl.startsWith('/')) { // Relative URL from our backend
        return `${apiBaseUrl}${streamData.streamUrl}`;
      }
      return streamData.streamUrl; // Absolute URL (e.g., direct from Peerflix if no transcode)
    }
    return null;
  }, [streamData, apiBaseUrl]);

  const formatTime = useCallback((seconds) => {
    if (isNaN(seconds) || seconds === null || seconds === undefined || seconds === Infinity) return '00:00';
    const date = new Date(0);
    date.setSeconds(seconds);
    const timeString = date.toISOString().substr(11, 8);
    return timeString.startsWith('00:') ? timeString.substr(3) : timeString;
  }, []);

  const cleanupIntervals = useCallback(() => {
    if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
    if (metadataPollIntervalRef.current) clearInterval(metadataPollIntervalRef.current);
  }, []);

  useEffect(() => {
    if (!initialStreamData) {
      setError('No stream data provided.');
      setIsLoading(false);
      navigate(-1); // Go back if no data
      return;
    }
    setStreamData(initialStreamData);
    setFullDuration(initialStreamData.fullDuration || 0);
    setTranscodingDetails(initialStreamData.transcoding || null);

    return cleanupIntervals;
  }, [initialStreamData, navigate, cleanupIntervals]);


  const sendActivityPing = useCallback(() => {
    if (streamData?.infoHash && apiBaseUrl) {
      const token = localStorage.getItem('token');
      fetch(`${apiBaseUrl}/api/streams/${streamData.infoHash}/activity`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: isPlaying ? 'playing' : 'paused' })
      }).catch(err => console.warn('Activity ping failed:', err));
    }
  }, [streamData, apiBaseUrl, isPlaying]);

  const fetchMetadata = useCallback(async () => {
    if (streamData?.infoHash && apiBaseUrl && (streamData.needsTranscoding || !fullDuration)) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${apiBaseUrl}/api/streams/${streamData.infoHash}/metadata`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const metadata = await response.json();
          if (metadata.fullDuration && metadata.fullDuration > 0 && !fullDuration) {
            setFullDuration(metadata.fullDuration);
          }
           if (streamData.needsTranscoding) {
            // Update current playable duration if transcoded file size gives a hint
            // This is tricky as `duration` from video element is more reliable for current playability
            const videoElementDuration = videoRef.current?.duration;
            if (videoElementDuration && isFinite(videoElementDuration)) {
                setDuration(videoElementDuration);
            }
             setTranscodingDetails(prev => ({
                ...prev,
                status: metadata.status,
                progress: metadata.fullDuration && videoElementDuration ? (videoElementDuration / metadata.fullDuration * 100).toFixed(1) + '%' : (prev?.progress || '0%')
            }));

            if(metadata.status === 'ready' && metadataPollIntervalRef.current) {
                 clearInterval(metadataPollIntervalRef.current); // Stop polling if ready
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch stream metadata:', err);
      }
    }
  }, [streamData, apiBaseUrl, fullDuration]);

  useEffect(() => {
    sendActivityPing(); // Initial ping
    activityIntervalRef.current = setInterval(sendActivityPing, 30 * 1000); // Ping every 30s

    if (streamData?.needsTranscoding || !fullDuration) {
        fetchMetadata(); // Initial metadata fetch
        metadataPollIntervalRef.current = setInterval(fetchMetadata, 7000); // Poll metadata every 7s
    }
    return cleanupIntervals;
  }, [sendActivityPing, fetchMetadata, streamData, fullDuration, cleanupIntervals]);


  const hideControls = useCallback(() => {
    if (isPlaying && !showSettingsMenu) {
      setShowControls(false);
    }
  }, [isPlaying, showSettingsMenu]);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(hideControls, 3000);
  }, [hideControls]);

  useEffect(() => {
    const container = playerContainerRef.current;
    if (container) {
      container.addEventListener('mousemove', resetControlsTimeout);
      container.addEventListener('mouseleave', hideControls);
    }
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (container) {
        container.removeEventListener('mousemove', resetControlsTimeout);
        container.removeEventListener('mouseleave', hideControls);
      }
    };
  }, [resetControlsTimeout, hideControls]);

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(err => setError(`Playback error: ${err.message}`));
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((e) => {
    if (!videoRef.current || !isFinite(duration) || duration === 0) return;
    const seekTime = parseFloat(e.target.value);
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  }, [duration]);

  const handleVolumeChange = useCallback((e) => {
    if (!videoRef.current) return;
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    videoRef.current.volume = newVolume;
    setIsMuted(newVolume === 0);
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoRef.current.muted = newMuted;
    if (!newMuted && volume === 0) setVolume(0.5); // Unmute to a sensible volume
  }, [isMuted, volume]);

  const handleFullscreenToggle = useCallback(() => {
    const elem = playerContainerRef.current;
    if (!elem) return;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => console.warn("Fullscreen request failed:", err));
    } else {
      document.exitFullscreen().catch(err => console.warn("Exit fullscreen failed:", err));
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handlePlaybackRateChange = useCallback((rate) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettingsMenu(false);
  }, []);
  
  const handleRestart = useCallback(() => {
    if(videoRef.current) videoRef.current.currentTime = 0;
  }, [])

  // Video Element Event Handlers
  const onLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const videoElementDuration = videoRef.current.duration;
      if (isFinite(videoElementDuration) && videoElementDuration > 0) {
        setDuration(videoElementDuration);
         if (!fullDuration || fullDuration === 0) { // If fullDuration wasn't provided or fetched yet
            setFullDuration(videoElementDuration);
        }
      }
      setIsLoading(false);
    }
  }, [fullDuration]);

  const onTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      const video = videoRef.current;
      if (video.buffered.length > 0) {
        const currentPlayableDuration = duration > 0 ? duration : fullDuration;
        if (currentPlayableDuration > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            setBuffered((bufferedEnd / currentPlayableDuration) * 100);
        }
      }
    }
  }, [duration, fullDuration]);
  
  const onVideoError = useCallback((e) => {
    const videoElement = e.target;
    let msg = 'Video playback error';
    if (videoElement.error) {
      switch (videoElement.error.code) {
        case videoElement.error.MEDIA_ERR_ABORTED: msg = 'Playback aborted.'; break;
        case videoElement.error.MEDIA_ERR_NETWORK: msg = 'A network error caused the video download to fail.'; break;
        case videoElement.error.MEDIA_ERR_DECODE: msg = 'The video playback was aborted due to a corruption problem or because the video used features your browser did not support.'; break;
        case videoElement.error.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = 'The video could not be loaded, either because the server or network failed or because the format is not supported.'; break;
        default: msg = 'An unknown error occurred.';
      }
    }
    setError(msg);
    setIsLoading(false);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ') { e.preventDefault(); handlePlayPause(); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); handleFullscreenToggle(); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); handleToggleMute(); }
      else if (e.key === 'ArrowRight' && videoRef.current) { e.preventDefault(); videoRef.current.currentTime += 10; }
      else if (e.key === 'ArrowLeft' && videoRef.current) { e.preventDefault(); videoRef.current.currentTime -= 10; }
      else if (e.key === 'Escape' && isFullscreen) { handleFullscreenToggle(); }
      else if (e.key === 'Escape' && !isFullscreen) { navigate(-1); } // Go back if not fullscreen
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleFullscreenToggle, handleToggleMute, isFullscreen, navigate]);


  const displayDuration = fullDuration > 0 ? fullDuration : duration;
  const currentProgressPercent = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0;

  return (
    <div className={`media-player-page ${isFullscreen ? 'fullscreen' : ''}`} ref={playerContainerRef}>
      {error && (
        <div className="player-error-overlay">
          <AlertTriangle size={48} className="error-icon" />
          <p className="error-message-text">{error}</p>
          <button onClick={() => videoRef.current?.load()} className="retry-button-overlay">Retry</button>
          <button onClick={() => navigate(-1)} className="back-button-overlay">Go Back</button>
        </div>
      )}

      {isLoading && !error && (
        <div className="player-loading-overlay">
          <Loader2 size={64} className="animate-spin" />
          <p>{transcodingDetails?.status === 'transcoding' ? `Transcoding (${transcodingDetails?.progress || '0%'})` : 'Loading Media...'}</p>
           {streamData?.needsTranscoding && fullDuration > 0 && (
             <p className="text-sm text-gray-400">Total Duration: {formatTime(fullDuration)}</p>
           )}
        </div>
      )}

      <video
        ref={videoRef}
        src={videoSrc || ''}
        className="main-video-element"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => { setIsPlaying(true); setIsLoading(false); }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onCanPlay={() => setIsLoading(false)}
        onCanPlayThrough={() => setIsLoading(false)}
        onError={onVideoError}
        onClick={handlePlayPause}
        onDoubleClick={handleFullscreenToggle}
        autoPlay={isPlaying}
        muted={isMuted}
        playsInline
      />

      <div className={`player-controls-container ${showControls ? 'visible' : ''}`}>
        <div className="player-title-bar">
            <h3>{streamData?.fileName || streamData?.movieTitle || 'Streaming Media'}</h3>
            {streamData?.needsTranscoding && transcodingDetails && (
                <span className={`transcoding-status-badge ${transcodingDetails.status}`}>
                   {transcodingDetails.status === 'transcoding' ? `Transcoding: ${transcodingDetails.progress || '...'}` : transcodingDetails.status}
                </span>
            )}
        </div>
        <div className="progress-bar-wrapper">
          <input
            type="range"
            min="0"
            max={isFinite(displayDuration) && displayDuration > 0 ? displayDuration : 0}
            step="any"
            value={currentTime}
            onChange={handleSeek}
            className="timeline-slider"
            disabled={isLoading || displayDuration === 0}
          />
          <div className="progress-bar-bg">
            <div className="progress-bar-buffered" style={{ width: `${buffered}%` }}></div>
            <div className="progress-bar-played" style={{ width: `${currentProgressPercent}%` }}></div>
          </div>
        </div>

        <div className="main-controls">
          <div className="controls-left">
            <button onClick={handlePlayPause} className="control-btn">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
             <button onClick={handleRestart} className="control-btn">
                <RotateCcw size={20} />
            </button>
            <div className="volume-control">
              <button onClick={handleToggleMute} className="control-btn">
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>
            <span className="time-display">{formatTime(currentTime)} / {formatTime(displayDuration)}</span>
          </div>

          <div className="controls-right">
            <div className="settings-control">
              <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className="control-btn">
                <Settings size={20} />
              </button>
              {showSettingsMenu && (
                <div className="settings-menu">
                  <p>Playback Speed</p>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                    <button
                      key={rate}
                      onClick={() => handlePlaybackRateChange(rate)}
                      className={playbackRate === rate ? 'active' : ''}
                    >
                      {rate === 1 ? 'Normal' : `${rate}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleFullscreenToggle} className="control-btn">
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaPlayerPage;