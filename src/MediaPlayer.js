import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Settings } from 'lucide-react';

const MediaPlayer = ({ streamData, onError }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullDuration, setFullDuration] = useState(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [transcodingProgress, setTranscodingProgress] = useState(null);

  const controlsTimeoutRef = useRef(null);

  // Create authenticated video URL
  useEffect(() => {
    if (streamData && streamData.streamUrl) {
      const token = localStorage.getItem('token');
      
      // Create a URL with auth token as query parameter
      const url = new URL(streamData.streamUrl);
      url.searchParams.set('token', token);
      
      setVideoSrc(url.toString());
      console.log('Setting video source with auth:', url.toString());

      // Set full duration if provided in streamData
      if (streamData.fullDuration) {
        setFullDuration(streamData.fullDuration);
        console.log('Got full duration from stream data:', streamData.fullDuration);
      }
    }
  }, [streamData]);

  // Fetch video metadata including full duration
  useEffect(() => {
    if (streamData && streamData.infoHash) {
      const fetchMetadata = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`https://188-245-179-212.nip.io/api/streams/${streamData.infoHash}/metadata`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const metadata = await response.json();
            console.log('Metadata response:', metadata);
            
            if (metadata.fullDuration && !fullDuration) {
              setFullDuration(metadata.fullDuration);
              console.log('Got full video duration from metadata:', metadata.fullDuration, 'seconds');
            }
            
            // Update transcoding progress
            setTranscodingProgress(metadata);
          }
        } catch (error) {
          console.warn('Could not fetch video metadata:', error);
        }
      };

      fetchMetadata();
      
      // Poll for metadata updates while transcoding
      const interval = setInterval(() => {
        if (streamData.needsTranscoding) {
          fetchMetadata();
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [streamData, fullDuration]);

  // Auto-hide controls
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Video event handlers
  const handleLoadStart = () => {
    setIsLoading(true);
    setError(null);
    console.log('Video load started');
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    console.log('Video can play');
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Update buffered amount
      const video = videoRef.current;
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / (video.duration || fullDuration || 1)) * 100;
        setBuffered(bufferedPercent);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      setDuration(videoDuration);
      console.log('Video metadata loaded, duration:', videoDuration);
      
      // If we don't have full duration yet, use the video duration
      if (!fullDuration && videoDuration && videoDuration > 0) {
        setFullDuration(videoDuration);
      }
    }
  };

  const handleError = (e) => {
    const video = videoRef.current;
    let errorMessage = 'Video playback error';
    
    console.error('Video error event:', e);
    console.error('Video error object:', video?.error);
    
    if (video && video.error) {
      switch (video.error.code) {
        case video.error.MEDIA_ERR_ABORTED:
          errorMessage = 'Video playback was aborted';
          break;
        case video.error.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error occurred while loading video';
          break;
        case video.error.MEDIA_ERR_DECODE:
          errorMessage = 'Video decoding error';
          break;
        case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Video format not supported or authentication failed';
          break;
        default:
          errorMessage = 'Unknown video error';
      }
    }
    
    setError(errorMessage);
    setIsLoading(false);
    if (onError) onError(errorMessage);
  };

  // Control functions
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(error => {
          console.error('Play failed:', error);
          setError('Failed to play video');
        });
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e) => {
    const displayDuration = fullDuration || duration;
    
    if (videoRef.current && displayDuration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickRatio = clickX / rect.width;
      const newTime = clickRatio * displayDuration;
      
      // Only allow seeking within the currently available video
      const maxSeekTime = Math.min(newTime, duration || displayDuration);
      
      console.log('Seeking to:', newTime, 'max allowed:', maxSeekTime);
      
      videoRef.current.currentTime = maxSeekTime;
      setCurrentTime(maxSeekTime);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const changePlaybackRate = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSettings(false);
    }
  };

  const restart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null || seconds === undefined) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const displayDuration = fullDuration || duration;
  const progressPercentage = displayDuration ? (currentTime / displayDuration) * 100 : 0;
  
  // Calculate transcoding progress if available
  const transcodingPercentage = fullDuration && duration ? (duration / fullDuration) * 100 : 0;

  if (!streamData) {
    return (
      <div className="w-full h-96 bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-white">No stream data available</p>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden">
      {/* Video Element */}
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-auto"
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleError}
          onMouseMove={resetControlsTimeout}
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          preload="metadata"
          crossOrigin="anonymous"
        />
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg">
              {streamData.needsTranscoding ? 'Transcoding video...' : 'Loading video...'}
            </p>
            {streamData.transcoding && (
              <p className="text-sm text-gray-300 mt-2">
                Converting {streamData.transcoding.originalFormat} to {streamData.transcoding.targetFormat}
              </p>
            )}
            {fullDuration && streamData.needsTranscoding && (
              <p className="text-sm text-gray-400 mt-1">
                Full duration: {formatTime(fullDuration)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-white text-center p-6">
            <p className="text-lg mb-4">⚠️ {error}</p>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  if (videoRef.current) {
                    videoRef.current.load();
                  }
                }} 
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-2"
              >
                Retry
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded"
              >
                Reload Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 text-xs text-left bg-gray-800 p-2 rounded max-w-md">
                <p><strong>Debug Info:</strong></p>
                <p>Stream URL: {streamData.streamUrl}</p>
                <p>Auth URL: {videoSrc}</p>
                <p>Token: {localStorage.getItem('token') ? 'Present' : 'Missing'}</p>
                <p>Duration: {duration} / Full: {fullDuration}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      {showControls && !isLoading && !error && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div 
              className="w-full h-2 bg-gray-600 rounded cursor-pointer relative"
              onClick={handleSeek}
            >
              {/* Transcoding Progress (background) */}
              {streamData.needsTranscoding && transcodingPercentage > 0 && (
                <div 
                  className="absolute h-full bg-yellow-600 rounded opacity-50"
                  style={{ width: `${transcodingPercentage}%` }}
                  title={`Transcoded: ${transcodingPercentage.toFixed(1)}%`}
                />
              )}
              {/* Buffered Progress */}
              <div 
                className="absolute h-full bg-gray-400 rounded"
                style={{ width: `${buffered}%` }}
                title={`Buffered: ${buffered.toFixed(1)}%`}
              />
              {/* Current Progress */}
              <div 
                className="absolute h-full bg-red-500 rounded"
                style={{ width: `${progressPercentage}%` }}
                title={`Progress: ${progressPercentage.toFixed(1)}%`}
              />
              {/* Progress Thumb */}
              <div 
                className="absolute w-4 h-4 bg-red-500 rounded-full -mt-1 -ml-2"
                style={{ left: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              {/* Play/Pause */}
              <button onClick={togglePlay} className="hover:text-red-500">
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>

              {/* Restart */}
              <button onClick={restart} className="hover:text-red-500">
                <RotateCcw size={20} />
              </button>

              {/* Volume */}
              <div className="flex items-center space-x-2">
                <button onClick={toggleMute} className="hover:text-red-500">
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Time Display */}
              <div className="text-sm">
                <span>{formatTime(currentTime)} / {formatTime(displayDuration)}</span>
                {fullDuration && fullDuration !== duration && streamData.needsTranscoding && (
                  <span className="text-yellow-400 ml-2 text-xs">
                    (transcoding: {transcodingPercentage.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Settings */}
              <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="hover:text-red-500"
                >
                  <Settings size={20} />
                </button>
                
                {showSettings && (
                  <div className="absolute bottom-8 right-0 bg-black bg-opacity-90 rounded p-2 min-w-32">
                    <p className="text-sm mb-2">Playback Speed</p>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`block w-full text-left px-2 py-1 text-sm hover:bg-gray-700 rounded ${
                          playbackRate === rate ? 'text-red-500' : ''
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="hover:text-red-500">
                <Maximize size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Info */}
      <div className="absolute top-4 left-4 text-white bg-black bg-opacity-50 rounded px-3 py-1">
        <p className="text-sm">
          {streamData.fileName} ({streamData.fileSizeGB} GB)
        </p>
        {streamData.needsTranscoding && (
          <div className="text-xs">
            <p className="text-yellow-400">
              Transcoding: {streamData.transcoding?.originalFormat} → {streamData.transcoding?.targetFormat}
            </p>
            {transcodingProgress && (
              <p className="text-gray-300">
                Status: {transcodingProgress.status} 
                {fullDuration && ` | Full: ${formatTime(fullDuration)}`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Transcoding Status Bar */}
      {streamData.needsTranscoding && transcodingPercentage > 0 && transcodingPercentage < 100 && (
        <div className="absolute top-16 left-4 right-4 bg-black bg-opacity-50 rounded px-3 py-2">
          <div className="flex justify-between items-center text-white text-xs">
            <span>Transcoding Progress</span>
            <span>{transcodingPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
            <div 
              className="bg-yellow-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${transcodingPercentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaPlayer;