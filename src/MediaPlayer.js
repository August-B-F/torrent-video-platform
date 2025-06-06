import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Settings, AlertCircle } from 'lucide-react';

const MediaPlayer = ({ streamData, onError }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
  const [retryCount, setRetryCount] = useState(0);
  
  // Stremio-specific state (simplified)
  const [stremioProgress, setStremioProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [peers, setPeers] = useState(0);

  const controlsTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Create video URL for Stremio
  const createVideoUrl = useCallback(() => {
    if (!streamData?.streamUrl) return null;
    
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token missing');
      return null;
    }
    
    try {
      const url = new URL(streamData.streamUrl);
      url.searchParams.set('token', token);
      return url.toString();
    } catch (err) {
      console.error('Error creating video URL:', err);
      setError('Invalid stream URL');
      return null;
    }
  }, [streamData]);

  // Poll Stremio for progress (much simpler than before)
  const fetchStremioProgress = useCallback(async () => {
    if (!streamData?.infoHash) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://188-245-179-212.nip.io/api/streams/${streamData.infoHash}/metadata`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update Stremio progress
        if (data.stremioStats) {
          setStremioProgress(data.stremioStats.progress || 0);
          setDownloadSpeed(data.stremioStats.downloadSpeed || 0);
          setPeers(data.stremioStats.peers || 0);
        }
        
        // Set video source when ready
        if (data.fileReady && !videoSrc) {
          const url = createVideoUrl();
          if (url) {
            setVideoSrc(url);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch Stremio progress:', error);
    }
  }, [streamData?.infoHash, videoSrc, createVideoUrl]);

  // Initialize video
  useEffect(() => {
    if (streamData) {
      console.log('🎬 Initializing Stremio stream:', streamData);
      
      // For Stremio, start polling immediately
      if (streamData.needsTranscoding) {
        fetchStremioProgress();
      } else {
        // Direct stream - set source immediately
        const url = createVideoUrl();
        if (url) {
          setVideoSrc(url);
        }
      }
    }
  }, [streamData, createVideoUrl, fetchStremioProgress]);

  // Polling for Stremio progress
  useEffect(() => {
    if (streamData?.needsTranscoding && streamData?.infoHash) {
      pollingIntervalRef.current = setInterval(() => {
        fetchStremioProgress();
      }, 3000); // Poll every 3 seconds
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [streamData?.needsTranscoding, streamData?.infoHash, fetchStremioProgress]);

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

  // Video event handlers (simplified)
  const handleLoadStart = () => {
    setIsLoading(true);
    setError(null);
    console.log('🎬 Video load started');
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setRetryCount(0);
    console.log('🎬 Video ready to play');
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      const video = videoRef.current;
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / (video.duration || 1)) * 100;
        setBuffered(bufferedPercent);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      setDuration(videoDuration);
      console.log('🎬 Video metadata loaded, duration:', videoDuration);
    }
  };

  const handleError = (e) => {
    const video = videoRef.current;
    let errorMessage = 'Video playback error';
    
    if (video && video.error) {
      switch (video.error.code) {
        case video.error.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error - torrent may still be downloading';
          break;
        case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Video not ready yet - torrent still downloading';
          break;
        default:
          errorMessage = 'Video error - check if torrent has enough seeders';
      }
    }
    
    setIsLoading(false);
    setError(errorMessage);
    if (onError) onError(errorMessage);
  };

  // Control functions (unchanged)
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(error => {
          console.error('Play failed:', error);
          setError('Failed to play video - torrent may still be downloading');
        });
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e) => {
    if (videoRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickRatio = clickX / rect.width;
      const newTime = clickRatio * duration;
      
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
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

  const retry = () => {
    setError(null);
    setRetryCount(prev => prev + 1);
    
    if (videoRef.current) {
      const url = createVideoUrl();
      if (url) {
        setVideoSrc(url);
        videoRef.current.load();
      }
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

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

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
      {(isLoading || (!videoSrc && streamData?.needsTranscoding)) && !error && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg">
              {!videoSrc ? 'Stremio is preparing your stream...' : 'Loading video...'}
            </p>
            
            {streamData.needsTranscoding && (
              <div className="mt-3 space-y-1">
                <p className="text-sm text-yellow-400">
                  📦 Download: {stremioProgress.toFixed(1)}%
                </p>
                {downloadSpeed > 0 && (
                  <p className="text-sm text-blue-400">
                    📥 {formatBytes(downloadSpeed)} • 👥 {peers} peers
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Powered by Stremio • Professional transcoding
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-white text-center p-6 max-w-md">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-lg mb-4">⚠️ {error}</p>
            
            <div className="space-y-2 mb-4">
              <button 
                onClick={retry}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-2 transition-colors"
              >
                Retry Stream
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors"
              >
                Reload Page
              </button>
            </div>
            
            <div className="text-xs text-gray-400">
              <p>Retry attempts: {retryCount}/5</p>
              <p>Download progress: {stremioProgress.toFixed(1)}%</p>
              <p>Peers: {peers}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls (simplified - removed progressive streaming complexity) */}
      {showControls && !isLoading && !error && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div 
              className="w-full h-2 bg-gray-600 rounded cursor-pointer relative"
              onClick={handleSeek}
            >
              {/* Download Progress (background) */}
              {stremioProgress > 0 && (
                <div 
                  className="absolute h-full bg-yellow-600 rounded opacity-50"
                  style={{ width: `${stremioProgress}%` }}
                  title={`Downloaded: ${stremioProgress.toFixed(1)}%`}
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

          {/* Controls */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              <button onClick={togglePlay} className="hover:text-red-500 transition-colors">
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>

              <button onClick={restart} className="hover:text-red-500 transition-colors">
                <RotateCcw size={20} />
              </button>

              <div className="flex items-center space-x-2">
                <button onClick={toggleMute} className="hover:text-red-500 transition-colors">
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

              <div className="text-sm">
                <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                {downloadSpeed > 0 && (
                  <span className="text-green-400 ml-2 text-xs">
                    📥 {formatBytes(downloadSpeed)}
                  </span>
                )}
                {peers > 0 && (
                  <span className="text-blue-400 ml-2 text-xs">
                    👥 {peers}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="hover:text-red-500 transition-colors"
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
                        className={`block w-full text-left px-2 py-1 text-sm hover:bg-gray-700 rounded transition-colors ${
                          playbackRate === rate ? 'text-red-500' : ''
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={toggleFullscreen} className="hover:text-red-500 transition-colors">
                <Maximize size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Info */}
      <div className="absolute top-4 left-4 text-white bg-black bg-opacity-50 rounded px-3 py-1">
        <p className="text-sm">
          {streamData.movieTitle || 'Stremio Stream'}
        </p>
        <div className="text-xs">
          <p className="text-green-400">
            🎬 Powered by Stremio • Smart Transcoding
          </p>
          {stremioProgress > 0 && (
            <p className="text-yellow-400">
              📦 Download: {stremioProgress.toFixed(1)}% • 👥 {peers} peers
            </p>
          )}
          {downloadSpeed > 0 && (
            <p className="text-blue-400">
              📊 Speed: {formatBytes(downloadSpeed)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaPlayer;