// src/components/common/MediaPlayerModal/MediaPlayerModal.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player/lazy';
import './MediaPlayerModal.css';

// ... (Icon components remain the same) ...
const PlayArrowIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>;
const VolumeUpIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>;
const VolumeOffIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path></svg>;
const FullscreenIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg>;
const FullscreenExitIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"></path></svg>;


const formatTime = (seconds) => {
  // ... (formatTime function remains the same)
  if (isNaN(seconds) || seconds === Infinity || seconds === null) {
    return '00:00';
  }
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours();
  const mm = date.getUTCMinutes();
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  if (hh) {
    return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
  }
  return `${mm}:${ss}`;
};

const MediaPlayerModal = ({ isOpen, onClose, trailerUrl, title, streamType = 'direct' }) => {
  // ... (other state and refs remain the same)
  const [playing, setPlaying] = useState(false); // Will be set to true for autoplay
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false); // MODIFICATION: Start trailers muted for better autoplay probability
  const [played, setPlayed] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isHlsReady, setIsHlsReady] = useState(false);

  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const hlsRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  const isHlsStream = streamType === 'hls' || trailerUrl?.endsWith('.m3u8');

  useEffect(() => {
    if (isOpen && trailerUrl) {
      setIsLoading(true);
      setError(null);
      setPlayed(0);
      setDuration(0);
      setRetryCount(0);
      setIsHlsReady(false);
      setPlaying(true); // MODIFICATION: Set to true for autoplay
      // setMuted(false); // Consider starting muted for better autoplay success
    } else if (!isOpen) {
      setPlaying(false);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    }
  }, [isOpen, trailerUrl]);

  // ... (HLS.js setup useEffect remains the same) ...
  useEffect(() => {
    if (!isOpen || !trailerUrl || !isHlsStream || !videoRef.current) return;

    const video = videoRef.current;
    let hls = null;

    const setupHls = async () => {
      try {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = trailerUrl;
          setIsHlsReady(true);
          if(playing) video.play().catch(e => console.warn("Native HLS autoplay failed", e)); // Attempt autoplay
          return;
        }
        const Hls = (await import('hls.js')).default;
        if (!Hls.isSupported()) {
          setError('HLS is not supported in this browser');
          return;
        }
        hls = new Hls({
          debug: false,
          // ... other HLS config ...
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(trailerUrl));
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          setIsHlsReady(true);
          setIsLoading(false);
          if (data.levels && data.levels[0]?.details?.totalduration) {
            setDuration(data.levels[0].details.totalduration);
          }
          if(playing && videoRef.current) videoRef.current.play().catch(e => console.warn("HLS.js autoplay failed", e)); // Attempt autoplay
        });
        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
            if (data.details.totalduration && data.details.totalduration !== Infinity) {
              setDuration(data.details.totalduration);
            }
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          // ... (HLS error handling)
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (retryCount < 3) {
                  retryTimeoutRef.current = setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                    if(hlsRef.current) hlsRef.current.loadSource(trailerUrl);
                  }, 2000 * (retryCount + 1));
                } else { setError('Network error: Unable to load stream'); setIsLoading(false); }
                break;
              default: setError('Unable to load stream'); setIsLoading(false); break;
            }
          }
        });
        hls.on(Hls.Events.FRAG_BUFFERED, () => setIsLoading(false));
        hls.attachMedia(video);
      } catch (err) { setError('Failed to init HLS.'); setIsLoading(false); }
    };
    setupHls();
    return () => { if (hls) hls.destroy(); };
  }, [isOpen, trailerUrl, isHlsStream, retryCount, playing]); // Added playing to dependencies

  // ... (playback control handlers, fullscreen, auto-hide controls, escape key handling remain the same) ...
  const handlePlayPause = useCallback(() => { //
    if (isHlsStream && videoRef.current) {
        if (playing) videoRef.current.pause();
        else videoRef.current.play().catch(err => setError('Playback failed.'));
    }
    setPlaying(!playing);
  }, [playing, isHlsStream, error]);

  const handleVolumeChange = useCallback((e) => {  //
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setMuted(newVolume === 0);
    if (videoRef.current && isHlsStream) videoRef.current.volume = newVolume;
  }, [isHlsStream]);

  const handleToggleMute = useCallback(() => { //
    const newMuted = !muted;
    setMuted(newMuted);
    if (videoRef.current && isHlsStream) videoRef.current.muted = newMuted;
    if (newMuted && volume === 0) setVolume(0.5);
  }, [muted, volume, isHlsStream]);
  
  const handleSeekMouseDown = useCallback(() => {!error && setSeeking(true)}, [error]); //
  const handleSeekChange = useCallback((e) => {!error && setPlayed(parseFloat(e.target.value))}, [error]); //
  const handleSeekMouseUp = useCallback((e) => { //
    if (error) return;
    setSeeking(false);
    const seekTo = parseFloat(e.target.value);
    if (isHlsStream && videoRef.current && duration > 0) {
      videoRef.current.currentTime = seekTo * duration;
    } else if (playerRef.current) {
      playerRef.current.seekTo(seekTo);
    }
   }, [isHlsStream, duration, error]);

  const handleProgress = useCallback((state) => { //
    if (!seeking && !error) {
      setPlayed(state.played);
      // For non-HLS, ReactPlayer provides duration
       if (!isHlsStream && playerRef.current) {
        const playerDuration = playerRef.current.getDuration();
        if (playerDuration && playerDuration > 0) setDuration(playerDuration);
      }
    }
  }, [seeking, error, isHlsStream]);

  const handleTimeUpdate = useCallback(() => { //
    if (!seeking && videoRef.current && duration > 0 && !error) {
      const currentTime = videoRef.current.currentTime;
      setPlayed(currentTime / duration);
    }
  }, [seeking, duration, error]);
  
  const handleDurationChange = useCallback(() => { //
    if (videoRef.current && videoRef.current.duration && isFinite(videoRef.current.duration) && !error) {
      setDuration(videoRef.current.duration);
    }
  }, [error]);
  const handleOnReady = useCallback(() => { // For ReactPlayer (non-HLS)
    setIsLoading(false);
    if (playerRef.current) {
        const playerDuration = playerRef.current.getDuration();
        if (playerDuration && playerDuration > 0) {
            setDuration(playerDuration);
        }
    }
  }, []);


  const handleFullscreenToggle = useCallback(() => {  //
      const elem = playerContainerRef.current;
        if (!elem) return;
        if (!document.fullscreenElement) elem.requestFullscreen?.().catch(err => console.warn("Fs err:",err));
        else document.exitFullscreen?.();
  }, []);
  
  useEffect(() => {  //
    const cb = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', cb);
    return () => document.removeEventListener('fullscreenchange', cb);
   }, []);

  const debouncedHideControls = useCallback(() => {  //
    if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
        if(playing && !seeking) setShowControls(false);
    }, 3000);
  }, [playing, seeking]);

  const handleMouseMove = useCallback(() => { //
      setShowControls(true);
      debouncedHideControls();
  }, [debouncedHideControls]);

  useEffect(() => { //
    if (isOpen) {
        setShowControls(true);
        debouncedHideControls();
    }
  }, [isOpen, debouncedHideControls]);

  useEffect(() => { //
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) handleFullscreenToggle();
        else onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose, handleFullscreenToggle]);

  if (!isOpen) return null;

  return (
    <div className="media-player-modal-overlay" onClick={onClose}>
      <div
        className={`media-player-modal-content ${showControls || !playing ? 'show-controls' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (playing && !seeking) setShowControls(false); }}
        ref={playerContainerRef}
      >
        <div className="media-player-header">
          <h3>{title || 'Playing Video'}</h3>
          <span className="stream-type-badge">{streamType.toUpperCase()}</span>
          <button onClick={onClose} className="media-player-close-btn" aria-label="Close player">×</button>
        </div>

        <div className="player-wrapper">
          {isLoading && (
            <div className="player-loader-container">
              <div className="player-loader"></div>
              <p>Loading stream...</p>
            </div>
          )}
          
          {error && (
            <div className="player-error">
              <p>{error}</p>
              <button onClick={() => {
                setError(null);
                setRetryCount(0); // Reset retry count
                setIsLoading(true);
                // For HLS, the HLS.js setup useEffect will re-trigger based on retryCount or if trailerUrl changes.
                // For direct ReactPlayer, we might need to force a re-render or re-init.
                // For now, simply resetting error and loading should be enough for HLS.js to retry via its own logic or the retryCount effect.
                if (isHlsStream && hlsRef.current && trailerUrl) {
                     hlsRef.current.loadSource(trailerUrl); // Explicitly try to reload the source
                } else if (!isHlsStream && playerRef.current) {
                    // For non-HLS, ReactPlayer might need a key change or similar to force reload.
                    // Or, you could temporarily set trailerUrl to null then back.
                    // For simplicity, we'll rely on ReactPlayer's internal error handling or a manual close/reopen.
                }
              }} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {isHlsStream ? (
            <video
              ref={videoRef}
              className="react-player" // Re-use class for consistent sizing
              style={{ width: '100%', height: '100%' }}
              playsInline
              autoPlay={playing} // MODIFICATION: Add autoPlay based on playing state
              muted={muted}    // MODIFICATION: Start muted
              onClick={handlePlayPause}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              onLoadedData={() => { // More reliable than onLoadedMetadata for duration
                  setIsLoading(false);
                  if (videoRef.current && videoRef.current.duration && isFinite(videoRef.current.duration)) {
                    setDuration(videoRef.current.duration);
                  }
              }}
              onLoadedMetadata={handleDurationChange} // Keep for safety
              onPlay={() => { setPlaying(true); setIsLoading(false); }}
              onPause={() => setPlaying(false)}
              onWaiting={() => setIsLoading(true)}
              onPlaying={() => setIsLoading(false)}
              onCanPlay={() => setIsLoading(false)}
              onError={(e) => {
                if (!error) setError('Video playback error.');
                setIsLoading(false);
              }}
            />
          ) : (
            <ReactPlayer
              ref={playerRef}
              url={trailerUrl}
              className="react-player"
              playing={playing} // MODIFICATION: Autoplay controlled by this state
              controls={false} // We use custom controls
              volume={volume}
              muted={muted} // MODIFICATION: Start muted
              onProgress={handleProgress}
              // onDuration will be called by ReactPlayer for non-HLS
              width="100%"
              height="100%"
              onReady={handleOnReady} // Use onReady for non-HLS
              onBuffer={() => setIsLoading(true)}
              onBufferEnd={() => setIsLoading(false)}
              onError={(e) => {
                setError('Failed to load video');
                setIsLoading(false);
              }}
              config={{
                youtube: {
                  playerVars: {
                    autoplay: 1, // Try to force YouTube autoplay
                    controls: 0, // Hide native YouTube controls
                    rel: 0, // Don't show related videos from other channels at the end
                    showinfo: 0, // Deprecated, but won't hurt
                    iv_load_policy: 3, // Don't show video annotations
                    modestbranding: 1, // Minimal YouTube branding
                  },
                },
                file: {
                  attributes: { controlsList: 'nodownload' }
                }
              }}
            />
          )}
        </div>

        <div className="media-player-controls">
           {/* Controls remain largely the same, ensure `playing` state toggles icons correctly */}
          <button onClick={handlePlayPause} className="control-button" disabled={isLoading || (!isHlsReady && isHlsStream) || !!error}>
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </button>

          <input
            type="range"
            min={0}
            max={0.999999} // Avoid issues with exactly 1
            step="any"
            value={played}
            onMouseDown={handleSeekMouseDown}
            onChange={handleSeekChange}
            onMouseUp={handleSeekMouseUp}
            className="progress-bar"
            style={{ backgroundSize: `${played * 100}% 100%` }}
            disabled={isLoading || duration === 0 || !!error}
          />

          <div className="time-display">
            {formatTime(played * duration)} / {formatTime(duration)}
          </div>

          <div className="volume-controls">
            <button onClick={handleToggleMute} className="control-button">
              {muted || volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step="any"
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="volume-slider"
              style={{ backgroundSize: `${(muted ? 0 : volume) * 100}% 100%` }}
            />
          </div>

          <button onClick={handleFullscreenToggle} className="control-button">
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaPlayerModal;