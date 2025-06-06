// src/components/pages/ItemDetailPage/ItemDetailPage.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import { useWatchlist } from '../../contexts/WatchlistContext';
import SelectFolderModal from '../Watchlist/SelectFolderModal';
import { usePopup } from '../../contexts/PopupContext';
import MediaPlayerModal from '../../common/MediaPlayerModal/MediaPlayerModal';
import './ItemDetailPage.css';

// Import Lucide icons
import {
  PlayCircle, PlusCircle, Film, Tv, DownloadCloud, Users, ArrowUpCircle, HardDrive, ChevronLeft, Search, Filter, Star, CalendarDays, Clock, Loader2, PlayIcon as PlayIconLucide
} from 'lucide-react';

// Helper function to parse quality from title (defined at module level)
const parseQualityFromTitle = (title) => {
  if (!title) return 'SD';
  const titleLower = title.toLowerCase();
  if (titleLower.includes('2160p') || titleLower.includes('4k') || titleLower.includes('uhd')) return '4K';
  if (titleLower.includes('1080p')) return '1080p';
  if (titleLower.includes('720p')) return '720p';
  if (titleLower.includes('bluray') || titleLower.includes('blu-ray') || titleLower.includes('bdrip')) return '1080p';
  if (titleLower.includes('web-dl') || titleLower.includes('webdl') || titleLower.includes('webrip') || titleLower.includes('hdrip') || titleLower.includes('web')) return '720p';
  if (titleLower.includes('dvdrip') || titleLower.includes('sd') || titleLower.includes('480p')) return 'SD';
  return 'SD';
};

// Helper function to parse size string to MB (defined at module level)
const parseSizeToMB = (sizeStr) => {
  if (!sizeStr) return 0;
  
  let numPart;
  let unitPart;

  if (typeof sizeStr === 'number') {
    numPart = sizeStr; // Assume bytes if number
    unitPart = 'bytes';
  } else if (typeof sizeStr === 'string') {
    const sizeLower = sizeStr.toLowerCase();
    const valueMatch = sizeStr.match(/[\d\.]+/);
    if (!valueMatch) return 0;
    numPart = parseFloat(valueMatch[0]);
    unitPart = sizeLower;
  } else {
    return 0;
  }

  if (unitPart.includes('gb')) return numPart * 1024;
  if (unitPart.includes('mb')) return numPart;
  if (unitPart.includes('kb')) return numPart / 1024;
  if (unitPart.includes('bytes')) return numPart / (1024 * 1024);
  
  // If it's just a number (already parsed or originally a number)
  if (!isNaN(numPart) && isFinite(numPart) && unitPart === 'bytes') { // Explicitly check if it was assumed bytes
    return numPart / (1024*1024);
  }
  return 0;
};

// User's provided scoreAndSortTorrents function (defined at module level)
const scoreAndSortTorrents = (torrents, searchQuery, itemType, episodeDetails) => {
  if (!Array.isArray(torrents)) return [];

  const qualityScores = {
    '4k': 5, '2160p': 5, 'uhd': 5,
    '1080p': 4, 'fhd': 4,
    '720p': 3, 'hd': 3,
    'sd': 1, '480p': 1, '360p': 0,
  };

  const releaseTypeScores = {
    'bluray': 5, 'blu-ray': 5, 'bdrip': 5, 'brrip': 5,
    'web-dl': 4, 'webdl': 4, 'web': 4,
    'webrip': 3,
    'hdrip': 2,
    'hdtv': 2,
    'dvdrip': 1, 'dvd': 1,
    'cam': -10, 'hdcam': -10,
    'telesync': -8, 'ts': -8,
  };

  const codecScores = {
    'av1': 3,
    'x265': 2, 'h265': 2, 'hevc': 2,
    'x264': 1, 'h264': 1, 'avc': 1,
    'xvid': -1, 'divx': -1,
  };

  return torrents
    .map(stream => {
      let score = 0;
      const titleLower = stream.title && typeof stream.title === 'string' ? stream.title.toLowerCase() : '';

      if ((stream.seeders || 0) > 0) {
        score += (stream.seeders || 0) * 5;
        score += (stream.peers || 0) * 0.5;
      } else {
        if ((stream.peers || 0) === 0) {
          score = -200;
        } else {
          score = -50;
        }
      }

      let qualityFound = false;
      // stream.quality is already parsed by parseQualityFromTitle before this function is called
      if (stream.quality && stream.quality !== 'N/A' && stream.quality !== 'SD') { // SD has low base score
        const qualityKey = stream.quality.toLowerCase().replace('p','');
        if (qualityScores[qualityKey]) {
          score += qualityScores[qualityKey] * 2.5; // Use the pre-parsed quality
          qualityFound = true;
        }
      }
      
      // Fallback to title parsing if stream.quality was 'N/A' or 'SD' initially and might be improved
      if (!qualityFound) {
        for (const q in qualityScores) {
          if (titleLower.includes(q)) {
            score += qualityScores[q]; // Add points based on keywords
            qualityFound = true;
            break;
          }
        }
      }
      if (!qualityFound) score -= 1;


      for (const rt in releaseTypeScores) {
        if (titleLower.includes(rt.replace('-', ''))) { // also check for 'web dl' etc.
          score += releaseTypeScores[rt];
          break; 
        }
      }
      
      for (const c in codecScores) {
          if (titleLower.includes(c)) {
              score += codecScores[c];
              break;
          }
      }
      
      if (stream.publishDate) score += 0.2;
      
      // Use the raw Size (bytes) from the original torrent object for scoring
      // The stream object passed to scoreAndSortTorrents will have `Size` (original bytes) and `size` (formatted string)
      const sizeForScoring = stream.Size || 0; // Use original byte size for scoring
      const sizeMB = parseSizeToMB(sizeForScoring); // Convert raw bytes to MB for scoring logic

      if (sizeMB > 0) {
        const q = stream.quality || parseQualityFromTitle(titleLower); // Use pre-parsed or re-parse for scoring context
        if (q === '4K') {
            if (sizeMB < 1500) score -=5; else if (sizeMB > 5000) score +=2;
        } else if (q === '1080p') {
            if (sizeMB < 600) score -=3; else if (sizeMB > 1500 && sizeMB < 20000) score +=1.5;
        } else if (q === '720p') {
            if (sizeMB < 250) score -=2; else if (sizeMB > 700 && sizeMB < 10000) score += 0.5;
        }
      } else {
        score -= 0.5;
      }
      
      if (titleLower.includes('bad') || titleLower.includes('poor') || titleLower.includes("wrong")) score -= 7;
      if (titleLower.includes('subbed') && !titleLower.includes('multi')) score -= 0.5;
      if (titleLower.includes('dubbed')) score -= 1;
      if (titleLower.includes('repack') || titleLower.includes('proper')) score += 1;

      return { ...stream, score };
    })
    .sort((a, b) => b.score - a.score);
};


const ItemDetailPage = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { cinemeta, isLoadingAddons, cinemetaError: globalAddonErr } = useAddons();
  const { fetchItemDetails: fetchItemDetailsFromContext, folders: allFolders } = useWatchlist();
  const { showPopup } = usePopup();

  const [metadata, setMetadata] = useState(null);
  const [allStreams, setAllStreams] = useState([]); 
  const [filteredStreamsForDisplay, setFilteredStreamsForDisplay] = useState([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false); 
  const [metaError, setMetaError] = useState('');
  const [streamError, setStreamError] = useState(''); 
  const [isSelectFolderModalOpen, setIsSelectFolderModalOpen] = useState(false);
  const [isTrailerPlayerModalOpen, setIsTrailerPlayerModalOpen] = useState(false);
  const [currentTrailerUrl, setCurrentTrailerUrl] = useState('');
  
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null); 
  const [showStreamSelection, setShowStreamSelection] = useState(false); 
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [currentStreamForPlayer, setCurrentStreamForPlayer] = useState(null);

  const [qualityFilter, setQualityFilter] = useState('1080p'); 
  const availableQualities = useMemo(() => ['All', '4K', '1080p', '720p', 'SD'], []);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    setApiBaseUrl(window.location.origin.includes('localhost') ? 'https://188-245-179-212.nip.io' : '');
  }, []);
  
  const processVideos = useCallback((videos) => {
    const regularSeasons = {}; const specialEpisodes = [];
    if (!videos) return { regularSeasons, specialEpisodes };
    videos.forEach(video => {
      const seasonNum = video.season;
      const episodeNum = video.number || video.episode;
      const isReleased = video.released ? new Date(video.released) <= new Date(today) : true;
      const episodeData = { ...video, id: video.id || `${metadata?.id}:${seasonNum}:${episodeNum}`, number: episodeNum, episode: episodeNum, isReleased };
      if (seasonNum && seasonNum > 0) {
        if (!regularSeasons[seasonNum]) regularSeasons[seasonNum] = [];
        regularSeasons[seasonNum].push(episodeData);
      } else { specialEpisodes.push(episodeData); }
    });
    Object.keys(regularSeasons).forEach(sn => regularSeasons[sn].sort((a,b) => (a.number||0)-(b.number||0)));
    specialEpisodes.sort((a,b) => (a.number||0)-(b.number||0));
    return { regularSeasons, specialEpisodes };
  }, [today, metadata?.id]);

  const { regularSeasons, specialEpisodes } = useMemo(() => {
    if (metadata?.type === 'series' && metadata.videos) return processVideos(metadata.videos);
    return { regularSeasons: {}, specialEpisodes: [] };
  }, [metadata, processVideos]);

  const availableSeasonNumbers = useMemo(() => 
    Object.keys(regularSeasons).map(Number).sort((a, b) => a - b),
  [regularSeasons]);

  const episodesForCurrentDisplay = useMemo(() => 
    selectedSeason === "specials" ? specialEpisodes : (regularSeasons[selectedSeason] || []),
  [selectedSeason, specialEpisodes, regularSeasons]);


  useEffect(() => {
    if (allStreams.length === 0) {
        setFilteredStreamsForDisplay([]);
        return;
    }
    // Objects in allStreams already have a `quality` property from the formatting step
    // and are already sorted by scoreAndSortTorrents.
    if (qualityFilter === 'All') {
        setFilteredStreamsForDisplay(allStreams);
    } else {
        setFilteredStreamsForDisplay(allStreams.filter(s => s.quality === qualityFilter));
    }
  }, [allStreams, qualityFilter]);

  const formatFileSize = useCallback((bytes) => { // Make it a useCallback or move outside if static
    if (!bytes || bytes === 0) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
    if (isNaN(numBytes) || numBytes === 0) return 'N/A';
    const i = Math.floor(Math.log(numBytes) / Math.log(k));
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);


  const fetchAndProcessTorrentResults = useCallback(async (forcedQuery) => {
    let currentSearchQueryForLogic = forcedQuery;

    if (!currentSearchQueryForLogic) {
        if (!metadata || !showStreamSelection) {
          if (selectedEpisode && !showStreamSelection) setAllStreams([]);
          return;
        }
        if (metadata.type === 'series' && !selectedEpisode && showStreamSelection) {
          setIsLoadingStreams(false);
          setStreamError("Please select an episode to find sources.");
          return;
        }

        if (metadata.type === 'series' && selectedEpisode) {
          const sn = selectedEpisode.season; 
          const en = selectedEpisode.number || selectedEpisode.episode;
          const name = metadata.name.replace(/[:\-–()']/g, '').replace(/\s+/g, ' ').trim();
          // Using only the specific SxxExx query first as it's most targeted
          currentSearchQueryForLogic = [`${name} S${String(sn).padStart(2,'0')}E${String(en).padStart(2,'0')}`];
        } else if (metadata.type === 'movie') {
          let movieName = metadata.name.replace(/[:\-–()']/g, '').replace(/\s+/g, ' ').trim();
          if (metadata.year) movieName += ` ${metadata.year}`;
          currentSearchQueryForLogic = [movieName];
        } else {
          setIsLoadingStreams(false); 
          return;
        }
    } else {
        // If forcedQuery is provided, wrap it in an array if it's a string
        currentSearchQueryForLogic = Array.isArray(forcedQuery) ? forcedQuery : [forcedQuery];
    }


    setIsLoadingStreams(true); 
    setStreamError('');
    setAllStreams([]);

    let allResultsAccumulated = [];
    let queryError = null;
    let fetchedAny = false;

    for (const query of currentSearchQueryForLogic) {
      try {
        const token = localStorage.getItem('token');
        if (!token) { queryError = "Authentication required."; break; }

        const response = await fetch(`${apiBaseUrl}/api/search?query=${encodeURIComponent(query)}&limit=150`, { 
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (!fetchedAny) queryError = `Search for "${query}" failed. (${response.status})`;
          continue;
        }

        const data = await response.json();
        if (data.Results && data.Results.length > 0) {
          allResultsAccumulated = allResultsAccumulated.concat(data.Results);
          fetchedAny = true;
        } else {
          if (!fetchedAny) queryError = `No results for "${query}".`;
        }
      } catch (e) {
        console.error(`ItemDetailPage: Error with query "${query}":`, e);
        if (!fetchedAny) queryError = `Error processing query "${query}".`;
      }
    }

    if (allResultsAccumulated.length > 0) {
      const uniqueResults = Array.from(new Map(allResultsAccumulated.map(stream => 
        [stream.MagnetUri || stream.Link || stream.Title, stream] // Prioritize MagnetUri for uniqueness
      )).values());

      const formattedStreams = uniqueResults.map(stream => ({
        Title: stream.Title, 
        title: stream.Title, 
        quality: parseQualityFromTitle(stream.Title),
        seeders: stream.Seeders || 0,
        peers: stream.Peers || 0,
        Size: stream.Size, // Raw size in bytes for scoring
        size: formatFileSize(stream.Size), // Formatted size string for display
        magnetLink: stream.MagnetUri || (stream.Link && stream.Link.startsWith('magnet:') ? stream.Link : null),
        publishDate: stream.PublishDate,
        tracker: stream.Tracker || stream.Site || 'Unknown',
        Guid: stream.Guid,
        CategoryDesc: stream.CategoryDesc,
      }));
      
      const validStreams = formattedStreams.filter(stream => stream.magnetLink && stream.magnetLink.startsWith('magnet:'));
      
      const itemTypeForScoring = metadata?.type;
      const episodeDetailsForScoring = selectedEpisode ? { season: selectedEpisode.season, episode: selectedEpisode.episode || selectedEpisode.number } : null;
      const mainSearchQuery = currentSearchQueryForLogic[0]; // Use the primary search query for context in scoring

      const sortedStreams = scoreAndSortTorrents(validStreams, mainSearchQuery, itemTypeForScoring, episodeDetailsForScoring); 

      setAllStreams(sortedStreams);
      setStreamError('');
    } else {
      setAllStreams([]);
      setStreamError(queryError || "No streams found after trying all queries.");
    }
    setIsLoadingStreams(false);
  }, [metadata, selectedEpisode, showStreamSelection, apiBaseUrl, formatFileSize]);


  useEffect(() => {
    if (metadata && showStreamSelection) {
        if (metadata.type === 'movie' || (metadata.type === 'series' && selectedEpisode)) {
            fetchAndProcessTorrentResults();
        }
    } else if (metadata?.type === 'series' && !selectedEpisode && showStreamSelection) {
        setStreamError("Select an episode to see its sources.");
        setAllStreams([]);
        setIsLoadingStreams(false);
    }
  }, [metadata, selectedEpisode, showStreamSelection, fetchAndProcessTorrentResults]);


  useEffect(() => {
    setIsLoadingMeta(true);
    setMetaError('');
    setAllStreams([]);
    setShowStreamSelection(false);
    setSelectedEpisode(null);
    setSelectedSeason(null);
    setQualityFilter('1080p');

    if (!id || !type) {
      setMetaError("Item ID or type is missing.");
      setIsLoadingMeta(false);
      return;
    }

    fetchItemDetailsFromContext(id, type)
      .then(data => {
        if (data) {
          setMetadata(data);
          if (data.type === 'movie') {
            setShowStreamSelection(true); // This will trigger the above useEffect to fetch streams
          } else if (data.type === 'series' && data.videos) {
            const processed = processVideos(data.videos);
            const firstSeasonNum = Object.keys(processed.regularSeasons).map(Number).sort((a,b) => a-b)[0];
            if (firstSeasonNum) {
                setSelectedSeason(firstSeasonNum);
            } else if (processed.specialEpisodes.length > 0) {
                setSelectedSeason("specials");
            }
          }
        } else {
          setMetaError(`Could not load metadata for ${type} ID ${id}.`);
        }
      })
      .catch(err => {
        console.error("Error fetching item details:", err);
        setMetaError(`Error loading details: ${err.message}`);
      })
      .finally(() => setIsLoadingMeta(false));
  }, [id, type, fetchItemDetailsFromContext, processVideos]);

  // handleEpisodeSelect is defined here
  const handleEpisodeSelect = useCallback((episode) => {
    setSelectedEpisode(episode);
    setShowStreamSelection(true); // This will trigger the useEffect for fetchAndProcessTorrentResults
  }, []);


  const handleStreamPlay = useCallback(async (magnetLink, title) => {
       if (!magnetLink) {
          showPopup("No magnet link available for this stream.", "warning");
          return;
      }
      showPopup(`Initiating stream for ${title}... This may take a moment.`, "info", 5000);
      setCurrentStreamForPlayer({ magnetLink, title, isLoading: true });

      try {
          const token = localStorage.getItem('token');
          if (!token) {
              showPopup("Authentication error. Please log in again.", "warning");
              setCurrentStreamForPlayer(null);
              return;
          }

          const response = await fetch(`${apiBaseUrl}/api/stream`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ magnetLink, movieTitle: title })
          });

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: `Server error ${response.status}` }));
              throw new Error(errorData.message || `Failed to start stream: ${response.statusText}`);
          }

          const receivedStreamData = await response.json();
          
          if (!receivedStreamData.streamUrl) {
              throw new Error("Backend did not return a stream URL.");
          }
          
          if (receivedStreamData.streamUrl.startsWith('/stream/')) {
              receivedStreamData.streamUrl = `${apiBaseUrl}${receivedStreamData.streamUrl}`;
          }
          
          navigate('/play', { state: { streamData: receivedStreamData } });

      } catch (err) {
          console.error("Error initiating stream:", err);
          showPopup(`Error: ${err.message}`, "warning", 6000);
          setCurrentStreamForPlayer(null);
      }
  }, [apiBaseUrl, navigate, showPopup]);

  const handleOpenSelectFolderModal = () => {
    if (!metadata || !metadata.id || !metadata.type) {
        showPopup("Item details not loaded yet.", "warning"); return;
      }
      if (allFolders.length === 0) {
        showPopup("No watchlists available. Create one first in 'My Lists'.", "info"); return;
      }
      setIsSelectFolderModalOpen(true);
  };

  const handlePlayTrailer = () => {
    let urlToPlay = null; 
    let foundTrailer = false;

    if (metadata?.trailers?.length > 0) {
      const trailer = metadata.trailers.find(t => t.source && t.type === 'Trailer');
      if (trailer) {
        const youtubeIdMatch = trailer.source.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        if (youtubeIdMatch && youtubeIdMatch[1]) {
            urlToPlay = `https://www.youtube.com/embed/${youtubeIdMatch[1]}`;
            foundTrailer = true;
        } else if (trailer.source.startsWith('http')) {
            urlToPlay = trailer.source;
            foundTrailer = true;
        }
      }
    }
    
    if (!foundTrailer && metadata?.trailer?.startsWith('ytid:')) {
      const youtubeId = metadata.trailer.substring(5);
      urlToPlay = `https://www.youtube.com/embed/${youtubeId}`;
      foundTrailer = true;
    } else if (!foundTrailer && metadata?.trailer?.startsWith('http')) {
        urlToPlay = metadata.trailer;
        foundTrailer = true;
    }

    if (foundTrailer && urlToPlay) {
      showPopup(`Playing trailer for ${metadata.name}`, "info");
      setCurrentTrailerUrl(urlToPlay);
      setIsTrailerPlayerModalOpen(true); // MediaPlayerModal gets type="direct" hardcoded
    } else {
      showPopup("No trailer available for this item.", "info");
    }
  };
  
  const handleBackToEpisodes = () => {
    setSelectedEpisode(null);
    setShowStreamSelection(false);
    setAllStreams([]); 
  };
  
  if (isLoadingAddons || (isLoadingMeta && !metadata)) return <div className="page-container"><div className="loading-message"><Loader2 className="animate-spin inline mr-2"/>Initializing & Loading Details...</div></div>;
  if (globalAddonErr && !metadata && !isLoadingMeta) return <div className="page-container"><div className="error-message global-error">{globalAddonErr}</div></div>;
  if (metaError && !isLoadingMeta && !metadata) return <div className="page-container"><div className="error-message global-error">{metaError}</div></div>;
  if (!metadata && !isLoadingMeta) return <div className="page-container"><div className="empty-message">Item not found or failed to load.</div></div>;
  if (isLoadingMeta || !metadata) return <div className="page-container"><div className="loading-message"><Loader2 className="animate-spin inline mr-2"/>Loading item details...</div></div>;

  const displayEpisodeSection = metadata.type === 'series' && (availableSeasonNumbers.length > 0 || specialEpisodes.length > 0);

  return (
    <div className="page-container item-detail-page">
      <div className="detail-hero" style={{ backgroundImage: `linear-gradient(to top, rgba(var(--bg-primary-rgb, 14,16,21), 1) 5%, rgba(var(--bg-primary-rgb, 14,16,21), 0.9) 20%, rgba(var(--bg-primary-rgb, 14,16,21), 0.6) 45%, transparent 100%), url(${metadata.background || metadata.poster || ''})` }}>
        <div className="detail-hero-content-wrapper">
          <div className="detail-poster-container">
            <img src={metadata.poster || 'https://dummyimage.com/300x450/000/fff.png&text=No+Poster'} alt={metadata.name} className="detail-poster-image" />
          </div>
          <div className="detail-info-actions-container">
            <h1 className="detail-title">{metadata.name}</h1>
            <div className="detail-meta-row">
              {metadata.year && <span className="meta-item"><CalendarDays size={14}/> {metadata.year}</span>}
              {metadata.runtime && <span className="meta-item"><Clock size={14}/> {metadata.runtime}</span>}
              {metadata.genres && metadata.genres.length > 0 && <span className="meta-item"><Film size={14}/> {metadata.genres.slice(0, 3).join(', ')}</span>}
              {metadata.imdbRating && <span className="meta-item imdb-rating"><Star size={14} fill="currentColor"/> {metadata.imdbRating}</span>}
            </div>
            <p className="detail-description">{metadata.description || 'No description available.'}</p>
            <div className="detail-actions">
              <button className="action-button primary" onClick={handlePlayTrailer}><PlayCircle size={18} /> Trailer</button>
              <button className="action-button secondary" onClick={handleOpenSelectFolderModal}><PlusCircle size={18}/> Add to List</button>
              {metadata.type === 'movie' && (
                <button 
                    className="action-button watch-button" 
                    onClick={() => { setShowStreamSelection(true); if (allStreams.length === 0 && !isLoadingStreams && !streamError) fetchAndProcessTorrentResults(); }}
                    disabled={isLoadingStreams || (currentStreamForPlayer?.isLoading && currentStreamForPlayer.title === metadata.name)}
                >
                   <Tv size={18}/>
                   { (currentStreamForPlayer?.isLoading && currentStreamForPlayer.title === metadata.name) ? "Starting..." : (showStreamSelection && (allStreams.length > 0 || isLoadingStreams) ? "Select Source" : "Watch Movie")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="page-main-content detail-page-body">
        {displayEpisodeSection && !showStreamSelection && (
          <div className="detail-section series-content-section">
            <div className="seasons-tabs-container">
              <h2>Seasons</h2>
              <div className="seasons-tabs">
                {availableSeasonNumbers.map(seasonNum => (<button key={seasonNum} className={`season-tab ${selectedSeason === seasonNum ? 'active' : ''}`} onClick={() => { setSelectedSeason(seasonNum); setSelectedEpisode(null); setShowStreamSelection(false); }}>Season {seasonNum}</button>))}
                {specialEpisodes.length > 0 && (<button key="specials" className={`season-tab ${selectedSeason === "specials" ? 'active' : ''}`} onClick={() => { setSelectedSeason("specials"); setSelectedEpisode(null); setShowStreamSelection(false);}}>Specials</button>)}
              </div>
            </div>
            {selectedSeason && episodesForCurrentDisplay.length > 0 && (
              <div className="episodes-list-container">
                <h2>{selectedSeason === "specials" ? "Special Episodes" : `Episodes - Season ${selectedSeason}`}</h2>
                <div className="episodes-grid">
                  {episodesForCurrentDisplay.map(ep => (
                    <div 
                        key={ep.id || `${ep.season}-${ep.number}`} 
                        className={`episode-card ${!ep.isReleased ? 'not-aired' : ''} ${selectedEpisode?.id === ep.id ? 'active-episode' : ''}`} 
                        onClick={() => ep.isReleased ? handleEpisodeSelect(ep) : showPopup("This episode has not aired yet.", "info")}
                    >
                      <div className="episode-thumbnail-wrapper">
                        {ep.thumbnail || ep.poster ? 
                            <img src={ep.thumbnail || ep.poster} alt={ep.name || ep.title || `Episode ${ep.number || ep.episode}`} className="episode-thumbnail"/> 
                            : <div className="episode-thumbnail-placeholder"><Tv size={32}/></div>
                        }
                        {ep.isReleased && <div className="episode-play-overlay"><PlayCircle size={40}/></div>}
                      </div>
                      <div className="episode-info">
                        <h4 className="episode-title" title={ep.name || ep.title || `Episode ${ep.number || ep.episode}`}>E{ep.number || ep.episode}. {ep.name || ep.title || 'Untitled Episode'}</h4>
                        <p className="episode-overview-short">{ep.overview || ep.description || 'No overview available.'}</p>
                        {ep.released && (
                            <span className={`episode-release-date ${!ep.isReleased ? 'future' : ''}`}>
                                <CalendarDays size={12} style={{marginRight: '4px', verticalAlign: 'text-bottom'}} />
                                {!ep.isReleased ? 'Airs: ' : 'Released: '} {new Date(ep.released).toLocaleDateString()}
                            </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
             {selectedSeason && episodesForCurrentDisplay.length === 0 && (<p className="empty-message">No episodes found for this season.</p>)}
          </div>
        )}
        
        {showStreamSelection && (
          <div className="detail-section streams-section">
            <div className="streams-header">
              <h2>
                <DownloadCloud size={22} style={{marginRight: "8px", verticalAlign: "bottom"}} />
                Sources for: {selectedEpisode ? `${metadata.name} - S${String(selectedEpisode.season).padStart(2, '0')}E${String(selectedEpisode.episode || selectedEpisode.number).padStart(2, '0')}` : metadata.name}
              </h2>
              {metadata.type === 'series' && selectedEpisode && (<button onClick={handleBackToEpisodes} className="back-to-episodes-btn"><ChevronLeft size={18} /> Back to Episodes</button>)}
            </div>
            
            <div className="stream-filters">
              <label htmlFor="qualityFilter"><Filter size={16} style={{marginRight: "5px", verticalAlign: "bottom"}}/> Quality:</label>
              <select id="qualityFilter" value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} className="quality-filter-select">
                {availableQualities.map(q => <option key={q} value={q}>{q === 'All' ? 'All Qualities' : q}</option>)}
              </select>
            </div>
            
            {isLoadingStreams && <div className="loading-message"><Loader2 className="animate-spin inline mr-2"/>Searching for streams...</div>}
            {streamError && !isLoadingStreams && <div className="error-message">{streamError}</div>}
            {!isLoadingStreams && filteredStreamsForDisplay.length === 0 && !streamError && (<p className="empty-message">No streams found for this selection and quality. Try 'All Qualities' or check backend indexers.</p>)}
            
            {!isLoadingStreams && filteredStreamsForDisplay.length > 0 && (
              <ul className="stream-list">
                {filteredStreamsForDisplay.map((stream) => ( // Removed index as it's not needed if Guid/MagnetUri is good for key
                  <li key={stream.Guid || stream.magnetLink || stream.title} className="stream-item">
                    <div className={`stream-quality-badge quality-${(stream.quality || 'sd').toLowerCase()}`}>
                        {stream.quality || 'SD'}
                    </div>
                    <div className="stream-info">
                      <span className="stream-title" title={stream.title}>{stream.title}</span>
                      <div className="stream-details">
                        <span><ArrowUpCircle size={14}/> {stream.seeders || 0}</span>
                        <span><Users size={14}/> {stream.peers || 0}</span>
                        <span><HardDrive size={14}/> {stream.size}</span> {/* Formatted size */}
                      </div>
                    </div>
                    <button 
                        className="stream-play-button" 
                        onClick={() => handleStreamPlay(stream.magnetLink, stream.title)}
                        disabled={!stream.magnetLink || (currentStreamForPlayer?.isLoading && currentStreamForPlayer.magnetLink === stream.magnetLink)}
                         title={!stream.magnetLink ? "Magnet link missing" : "Play stream"}
                    >
                       {(currentStreamForPlayer?.isLoading && currentStreamForPlayer.magnetLink === stream.magnetLink) 
                           ? <Loader2 size={18} className="animate-spin"/> 
                           : <PlayIconLucide size={18}/>
                       }
                       <span className="play-button-text">
                           {(currentStreamForPlayer?.isLoading && currentStreamForPlayer.magnetLink === stream.magnetLink) ? "Starting..." : "Play"}
                       </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </main>
      {isSelectFolderModalOpen && metadata && (
        <SelectFolderModal 
          isOpen={isSelectFolderModalOpen} 
          onClose={() => setIsSelectFolderModalOpen(false)} 
          folders={allFolders} 
          itemId={metadata.id} 
          itemType={metadata.type} 
          itemTitle={metadata.name || "this item"}
        />
      )}
      {isTrailerPlayerModalOpen && currentTrailerUrl && (
        <MediaPlayerModal
          isOpen={isTrailerPlayerModalOpen}
          onClose={() => setIsTrailerPlayerModalOpen(false)}
          trailerUrl={currentTrailerUrl}
          title={`Trailer: ${metadata?.name || 'Video'}`}
          streamType="direct" 
        />
      )}
    </div>
  );
};

export default ItemDetailPage;