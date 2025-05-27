import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player/lazy';
import './MediaPlayerModal.css';

// Icon components (keep all your existing icons)
const PlayArrowIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>;
const VolumeUpIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>;
const VolumeOffIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path></svg>;
const FullscreenIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg>;
const FullscreenExitIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"></path></svg>;

const formatTime = (seconds) => {
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
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const hlsRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isHlsReady, setIsHlsReady] = useState(false);

  const isHlsStream = streamType === 'hls' || trailerUrl?.endsWith('.m3u8');

  // Reset state when modal opens/closes or URL changes
  useEffect(() => {
    if (isOpen && trailerUrl) {
      setIsLoading(true);
      setError(null);
      setPlayed(0);
      setDuration(0);
      setRetryCount(0);
      setIsHlsReady(false);
      setPlaying(false); // Start paused
    } else if (!isOpen) {
      // Cleanup when closing
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

  // HLS.js setup
  useEffect(() => {
    if (!isOpen || !trailerUrl || !isHlsStream || !videoRef.current) return;

    const video = videoRef.current;
    let hls = null;

    const setupHls = async () => {
      try {
        // Check for native HLS support first
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          console.log('Using native HLS support');
          video.src = trailerUrl;
          setIsHlsReady(true);
          return;
        }

        // Import and setup HLS.js
        console.log('Setting up HLS.js for:', trailerUrl);
        const Hls = (await import('hls.js')).default;
        
        if (!Hls.isSupported()) {
          setError('HLS is not supported in this browser');
          return;
        }

        hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false, // Disable for better stability
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          maxBufferSize: 60 * 1000 * 1000, // 60 MB
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 3,
          maxFragLookUpTolerance: 0.25,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: Infinity,
          liveDurationInfinity: true, // Important for event streams
          levelLoadingTimeOut: 10000,
          manifestLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 4,
          manifestLoadingMaxRetry: 4,
          xhrSetup: function(xhr) {
            xhr.withCredentials = false;
          }
        });

        hlsRef.current = hls;

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log('HLS media attached');
          hls.loadSource(trailerUrl);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log('HLS manifest parsed', data);
          setIsHlsReady(true);
          setIsLoading(false);
          
          // Try to get duration from manifest
          if (data.levels && data.levels[0]) {
            const level = data.levels[0];
            if (level.details && level.details.totalduration) {
              setDuration(level.details.totalduration);
            }
          }
        });

        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          if (data.details.totalduration) {
            setDuration(data.details.totalduration);
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Fatal network error');
                if (retryCount < 3) {
                  retryTimeoutRef.current = setTimeout(() => {
                    console.log('Retrying HLS load...');
                    setRetryCount(prev => prev + 1);
                    hls.loadSource(trailerUrl);
                  }, 2000);
                } else {
                  setError('Network error: Unable to load stream');
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Fatal media error, trying to recover');
                hls.recoverMediaError();
                break;
              default:
                setError('Unable to load stream');
                break;
            }
          }
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          setIsLoading(false);
        });

        hls.attachMedia(video);

      } catch (err) {
        console.error('Error setting up HLS:', err);
        setError('Failed to initialize video player');
        setIsLoading(false);
      }
    };

    setupHls();

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [isOpen, trailerUrl, isHlsStream, retryCount]);

  // Playback control handlers
  const handlePlayPause = useCallback(() => {
    if (isHlsStream && videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Play error:', err);
          setError('Failed to start playback');
        });
      }
    }
    setPlaying(!playing);
  }, [playing, isHlsStream]);

  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setMuted(newVolume === 0);
    if (videoRef.current && isHlsStream) {
      videoRef.current.volume = newVolume;
    }
  }, [isHlsStream]);

  const handleToggleMute = useCallback(() => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (videoRef.current && isHlsStream) {
      videoRef.current.muted = newMuted;
    }
    if (newMuted && volume === 0) setVolume(0.5);
  }, [muted, volume, isHlsStream]);

  const handleSeekMouseDown = useCallback(() => setSeeking(true), []);

  const handleSeekChange = useCallback((e) => {
    setPlayed(parseFloat(e.target.value));
  }, []);

  const handleSeekMouseUp = useCallback((e) => {
    setSeeking(false);
    const seekTo = parseFloat(e.target.value);
    
    if (isHlsStream && videoRef.current && duration > 0) {
      const seekTime = seekTo * duration;
      console.log(`Seeking to ${seekTime}s of ${duration}s`);
      videoRef.current.currentTime = seekTime;
    } else if (playerRef.current) {
      playerRef.current.seekTo(seekTo);
    }
  }, [isHlsStream, duration]);

  const handleProgress = useCallback((state) => {
    if (!seeking) {
      setPlayed(state.played);
    }
  }, [seeking]);

  const handleTimeUpdate = useCallback(() => {
    if (!seeking && videoRef.current && duration > 0) {
      const currentTime = videoRef.current.currentTime;
      const progress = currentTime / duration;
      setPlayed(progress);
    }
  }, [seeking, duration]);

  const handleDurationChange = useCallback(() => {
    if (videoRef.current && videoRef.current.duration && isFinite(videoRef.current.duration)) {
      console.log('Duration updated:', videoRef.current.duration);
      setDuration(videoRef.current.duration);
    }
  }, []);

  // Fullscreen handling
  const handleFullscreenToggle = useCallback(() => {
    const elem = playerContainerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen?.() ||
      elem.mozRequestFullScreen?.() ||
      elem.webkitRequestFullscreen?.() ||
      elem.msRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() ||
      document.mozCancelFullScreen?.() ||
      document.webkitExitFullscreen?.() ||
      document.msExitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach(event => document.addEventListener(event, onFullscreenChange));
    return () => events.forEach(event => document.removeEventListener(event, onFullscreenChange));
  }, []);

  // Auto-hide controls
  const debouncedHideControls = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (playing && !seeking) {
        setShowControls(false);
      }
    }, 3000);
  }, [playing, seeking]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    debouncedHideControls();
  }, [debouncedHideControls]);

  useEffect(() => {
    if (isOpen) {
      setShowControls(true);
      debouncedHideControls();
    }
  }, [isOpen, debouncedHideControls]);

  // Escape key handling
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          handleFullscreenToggle();
        } else {
          onClose();
        }
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
                setRetryCount(0);
                setIsLoading(true);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {isHlsStream ? (
            <video
              ref={videoRef}
              className="react-player"
              style={{ width: '100%', height: '100%' }}
              playsInline
              onClick={handlePlayPause}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              onLoadedMetadata={handleDurationChange}
              onPlay={() => { setPlaying(true); setIsLoading(false); }}
              onPause={() => setPlaying(false)}
              onWaiting={() => setIsLoading(true)}
              onPlaying={() => setIsLoading(false)}
              onCanPlay={() => setIsLoading(false)}
              onError={(e) => {
                console.error('Video error:', e);
                if (!error) {
                  setError('Video playback error');
                }
              }}
              volume={volume}
              muted={muted}
            />
          ) : (
            <ReactPlayer
              ref={playerRef}
              url={trailerUrl}
              className="react-player"
              playing={playing}
              controls={false}
              volume={volume}
              muted={muted}
              onProgress={handleProgress}
              onDuration={setDuration}
              width="100%"
              height="100%"
              onReady={() => {
                setIsLoading(false);
                console.log('ReactPlayer ready');
              }}
              onBuffer={() => setIsLoading(true)}
              onBufferEnd={() => setIsLoading(false)}
              onError={(e) => {
                console.error("ReactPlayer Error:", e);
                setError('Failed to load video');
                setIsLoading(false);
              }}
              config={{
                youtube: {
                  playerVars: { showinfo: 0, autoplay: 0, modestbranding: 1, rel: 0, controls: 0 },
                },
                file: {
                  attributes: { controlsList: 'nodownload' }
                }
              }}
            />
          )}
        </div>

        <div className="media-player-controls">
          <button onClick={handlePlayPause} className="control-button" disabled={!isHlsReady && isHlsStream}>
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </button>

          <input
            type="range"
            min={0}
            max={0.999999}
            step="any"
            value={played}
            onMouseDown={handleSeekMouseDown}
            onChange={handleSeekChange}
            onMouseUp={handleSeekMouseUp}
            className="progress-bar"
            style={{ backgroundSize: `${played * 100}% 100%` }}
            disabled={isLoading || duration === 0}
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