import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player/lazy';
import './MediaPlayerModal.css'; // We will heavily update this CSS

// --- Icon SVGs (or use react-icons) ---
const PlayArrowIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>;
const VolumeUpIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>;
const VolumeOffIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path></svg>;
const FullscreenIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg>;
const FullscreenExitIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"></path></svg>;
// --- End Icons ---

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds === Infinity) {
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


const MediaPlayerModal = ({ isOpen, onClose, trailerUrl, title }) => {
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0); // Progress from 0 to 1
  const [seeking, setSeeking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        if (isFullscreen) {
          handleFullscreenToggle(); // Exit fullscreen first if active
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
      setPlaying(true); // Autoplay when modal opens
      setIsLoading(true); // Assume loading when a new URL is set or modal opens
    } else {
      setPlaying(false); // Stop playback when modal closes
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose, isFullscreen, handleFullscreenToggle]); // Added isFullscreen to re-bind if it changes

  const handlePlayPause = () => setPlaying(!playing);
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setMuted(newVolume === 0);
  };
  const handleToggleMute = () => {
    setMuted(!muted);
    if (muted && volume === 0) setVolume(0.5); // Unmute to a default volume
  };
  const handleSeekMouseDown = () => setSeeking(true);
  const handleSeekChange = (e) => {
    setPlayed(parseFloat(e.target.value));
  };
  const handleSeekMouseUp = (e) => {
    setSeeking(false);
    playerRef.current?.seekTo(parseFloat(e.target.value));
  };
  const handleProgress = (state) => {
    if (!seeking) {
      setPlayed(state.played);
    }
  };
  const handleDuration = (newDuration) => setDuration(newDuration);

  const handleFullscreenToggle = () => {
    const elem = playerContainerRef.current;
    if (!elem) return;

    if (!isFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
      } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    // Note: Actual fullscreen state is better managed via 'fullscreenchange' event
  };
  
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);


  const debouncedHideControls = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (playing) { // Only hide if playing
        setShowControls(false);
      }
    }, 3000);
  }, [playing]);

  const handleMouseMove = () => {
    setShowControls(true);
    debouncedHideControls();
  };
  
  useEffect(() => {
    if (isOpen) {
        setShowControls(true);
        debouncedHideControls();
    }
  }, [isOpen, debouncedHideControls]);


  if (!isOpen) return null;

  return (
    <div className="media-player-modal-overlay" onClick={onClose}>
      <div 
        className={`media-player-modal-content ${showControls || !playing ? 'show-controls' : ''}`} 
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if(playing) setShowControls(false);}} // Hide on mouse leave if playing
        ref={playerContainerRef}
      >
        <div className="media-player-header">
          <h3>{title || 'Play Trailer'}</h3>
          <button onClick={onClose} className="media-player-close-btn" aria-label="Close player">×</button>
        </div>

        <div className="player-wrapper">
          {isLoading && <div className="player-loader"></div>}
          <ReactPlayer
            ref={playerRef}
            url={trailerUrl}
            className="react-player"
            playing={playing}
            controls={false} // We use custom controls
            volume={volume}
            muted={muted}
            onProgress={handleProgress}
            onDuration={handleDuration}
            width="100%"
            height="100%"
            onReady={() => { setIsLoading(false); setPlaying(true); debouncedHideControls(); }}
            onBuffer={() => setIsLoading(true)}
            onBufferEnd={() => setIsLoading(false)}
            onError={(e) => {
              console.error("ReactPlayer Error:", e);
              setIsLoading(false); 
              // You could show an error message within the player here
            }}
            config={{
              youtube: {
                playerVars: {
                  showinfo: 0,
                  autoplay: 1,
                  modestbranding: 1,
                  rel: 0,
                  controls: 0, // Ensure YouTube controls are also off
                },
              },
              file: {
                attributes: {
                    controlsList: 'nodownload' // Example for file player
                }
              }
            }}
          />
        </div>

        <div className="media-player-controls">
          <button onClick={handlePlayPause} className="control-button">
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </button>

          <input
            type="range" min={0} max={0.999999} step="any"
            value={played}
            onMouseDown={handleSeekMouseDown}
            onChange={handleSeekChange}
            onMouseUp={handleSeekMouseUp}
            className="progress-bar"
            style={{ backgroundSize: `${played * 100}% 100%` }}
          />
          
          <div className="time-display">
            {formatTime(played * duration)} / {formatTime(duration)}
          </div>

          <div className="volume-controls">
            <button onClick={handleToggleMute} className="control-button">
              {muted || volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </button>
            <input
              type="range" min={0} max={1} step="any"
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