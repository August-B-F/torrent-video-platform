// src/components/pages/ItemDetailPage/ItemDetailPage.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import { useWatchlist } from '../../contexts/WatchlistContext';
import SelectFolderModal from '../Watchlist/SelectFolderModal';
import { usePopup } from '../../contexts/PopupContext';
import MediaPlayerModal from '../../common/MediaPlayerModal/MediaPlayerModal';
import './ItemDetailPage.css';

// SVG Icons
const PlayIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
);
const AddToListIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
const DownloadIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);
const BackIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
);

// Helper function to parse size string to MB
const parseSizeToMB = (sizeStr) => {
  if (!sizeStr || typeof sizeStr !== 'string') return 0;
  const value = parseFloat(sizeStr);
  if (isNaN(value)) return 0;
  if (sizeStr.toUpperCase().includes('GB')) return value * 1024;
  if (sizeStr.toUpperCase().includes('MB')) return value;
  if (sizeStr.toUpperCase().includes('KB')) return value / 1024;
  return 0;
};

// Helper function to score and sort torrents
const scoreAndSortTorrents = (torrents) => {
  if (!Array.isArray(torrents)) return [];

  const qualityScores = {
    '4k': 5, '2160p': 5, 'uhd': 5,
    '1080p': 4, 'fhd': 4,
    '720p': 3, 'hd': 3,
    'sd': 1, '480p': 1, '360p': 0,
  };

  const releaseTypeScores = {
    'bluray': 5, 'blu-ray': 5, 'bdrip': 5, 'brrip': 5,
    'web-dl': 4, 'webdl': 4, 'web': 4, // Added 'web'
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
      const titleLower = stream.title ? stream.title.toLowerCase() : '';

      if ((stream.Seeders || 0) > 0) {
        score += (stream.Seeders || 0) * 5;
        score += (stream.Peers || 0) * 0.5; // Peers are less important than seeders
      } else {
         // Allow 0 seeder files if peers are present, but penalize heavily if both are 0
        if ((stream.Peers || 0) === 0) {
            score = -200; // Very unlikely to work
        } else {
            score = -50; // Likely stuck or very slow
        }
      }

      let qualityFound = false;
      if (stream.quality && stream.quality !== 'N/A') {
        const qualityKey = stream.quality.toLowerCase().replace('p','');
        if (qualityScores[qualityKey]) {
          score += qualityScores[qualityKey] * 2.5; // Higher weight for pre-parsed quality
          qualityFound = true;
        }
      }
      if (!qualityFound) {
        for (const q in qualityScores) {
          if (titleLower.includes(q)) {
            score += qualityScores[q];
            qualityFound = true;
            break;
          }
        }
      }
       if (!qualityFound) score -= 1; // Penalize if no quality info can be derived

      for (const rt in releaseTypeScores) {
        if (titleLower.includes(rt.replace('-', ''))) {
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
      
      if (stream.PublishDate) score += 0.2;

      const sizeMB = parseSizeToMB(stream.size);
      if (sizeMB > 0) {
        const q = stream.quality || (titleLower.includes('4k') || titleLower.includes('2160p') ? '4K' : titleLower.includes('1080p') ? '1080p' : titleLower.includes('720p') ? '720p' : 'SD');
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
      if (titleLower.includes('repack') || titleLower.includes('proper')) score += 1; // Repacks/propers are often fixes

      return { ...stream, score };
    })
    .sort((a, b) => b.score - a.score);
};


const ItemDetailPage = () => {
  const { type, id } = useParams();
  const { cinemeta, isLoadingAddons, cinemetaError: globalAddonErr } = useAddons();
  const { fetchItemDetails: fetchItemDetailsFromContext, folders: allFolders } = useWatchlist();
  const { showPopup } = usePopup();

  const [metadata, setMetadata] = useState(null);
  const [allStreams, setAllStreams] = useState([]);
  const [filteredStreams, setFilteredStreams] = useState([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [streamError, setStreamError] = useState('');
  const [isSelectFolderModalOpen, setIsSelectFolderModalOpen] = useState(false);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [currentTrailerUrl, setCurrentTrailerUrl] = useState('');
  const [activeStreamMagnet, setActiveStreamMagnet] = useState(null);

  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  // State to control torrent visibility for movies AND series episodes
  const [showTorrents, setShowTorrents] = useState(false); 
  const [qualityFilter, setQualityFilter] = useState('1080p');
  const availableQualities = useMemo(() => ['All', '4K', '1080p', '720p', 'SD'], []);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [currentStreamType, setCurrentStreamType] = useState('direct');

  const processVideos = useCallback((videos) => {
    const regularSeasons = {}; const specialEpisodes = [];
    videos.forEach(video => {
      const seasonNum = video.season;
      const episodeNum = video.number || video.episode;
      const isReleased = video.released ? new Date(video.released) <= new Date(today) : true;
      const episodeData = { ...video, number: episodeNum, isReleased };
      if (seasonNum && seasonNum > 0) {
        if (!regularSeasons[seasonNum]) regularSeasons[seasonNum] = [];
        regularSeasons[seasonNum].push(episodeData);
      } else { specialEpisodes.push(episodeData); }
    });
    Object.keys(regularSeasons).forEach(sn => regularSeasons[sn].sort((a,b) => (a.number||0)-(b.number||0)));
    specialEpisodes.sort((a,b) => (a.number||0)-(b.number||0));
    return { regularSeasons, specialEpisodes };
  }, [today]);

  const { regularSeasons, specialEpisodes } = useMemo(() => {
    if (metadata?.type === 'series' && metadata.videos) return processVideos(metadata.videos);
    return { regularSeasons: {}, specialEpisodes: [] };
  }, [metadata, processVideos]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setIsLoadingMeta(true); setMetaError(''); setMetadata(null);
    setSelectedSeason(null); setSelectedEpisode(null); setAllStreams([]);
    setShowTorrents(false); // Reset torrent visibility
    setQualityFilter('1080p'); setActiveStreamMagnet(null);

    if (isLoadingAddons || !id || !type) return;

    const fetchMeta = async () => {
      if (!cinemeta && !globalAddonErr) {
        setMetaError('Cinemeta addon not available.'); setIsLoadingMeta(false); return;
      }
      if (globalAddonErr) {
        setMetaError(`Cinemeta Error: ${globalAddonErr}`); setIsLoadingMeta(false); return;
      }
      try {
        const fetchedMeta = await fetchItemDetailsFromContext(id, type);
        if (fetchedMeta && fetchedMeta.name) {
          setMetadata(fetchedMeta);
          if (fetchedMeta.type === 'movie') {
            setShowTorrents(true); // Show torrents directly for movies
          } else if (fetchedMeta.type === 'series' && fetchedMeta.videos?.length > 0) {
            const processed = processVideos(fetchedMeta.videos);
            const firstRegularSeason = Object.keys(processed.regularSeasons).map(Number).sort((a, b) => a - b)[0];
            if (firstRegularSeason) setSelectedSeason(firstRegularSeason);
            else if (processed.specialEpisodes.length > 0) setSelectedSeason("specials");
          }
        } else { setMetaError(`Metadata not found for ${type} ID ${id}.`); }
      } catch (e) {
        console.error("ItemDetailPage: Error fetching metadata:", e);
        setMetaError(`Failed to load metadata: ${e.message}.`);
      } finally { setIsLoadingMeta(false); }
    };
    fetchMeta();
  }, [type, id, isLoadingAddons, cinemeta, globalAddonErr, fetchItemDetailsFromContext, processVideos]);

  useEffect(() => {
    const fetchTorrents = async () => {
      // Condition to fetch: metadata exists AND (it's a movie and showTorrents is true OR an episode is selected and showTorrents is true)
      if (!metadata || !showTorrents) {
        // if an episode was selected but now we are hiding torrents, clear streams
        if (selectedEpisode && !showTorrents) setAllStreams([]);
        return;
      }
      // If it's a series but no episode is selected yet, don't fetch general series torrents unless showTorrents was explicitly set for series (e.g. by a main download button)
      if (metadata.type === 'series' && !selectedEpisode && !showTorrents) {
         setIsLoadingStreams(false); return;
      }


      setIsLoadingStreams(true); setStreamError('');
      let currentSearchQueries = [];

      if (metadata.type === 'series' && selectedEpisode) {
        const sn = selectedEpisode.season; const en = selectedEpisode.number || selectedEpisode.episode;
        const sPad = String(sn).padStart(2,'0'); const ePad = String(en).padStart(2,'0');
        const name = metadata.name.replace(/[:\-–()']/g, '').replace(/\s+/g, ' ').trim();
        currentSearchQueries = [`${name} S${sPad}E${ePad}`, `${name} Season ${sn} Episode ${en}`];
      } else if (metadata.type === 'movie') { // Fetch for movie only if showTorrents is true (now set by default for movies)
        let movieName = metadata.name.replace(/[:\-–()']/g, '').replace(/\s+/g, ' ').trim();
        if (metadata.year) movieName += ` ${metadata.year}`;
        currentSearchQueries = [movieName];
      } else {
        setIsLoadingStreams(false); return;
      }
      // ... (rest of the torrent fetching logic from previous good version, ensuring setAllStreams is called with sorted streams)
       let allResultsAccumulated = [];
      let queryError = null;
      let fetchedAny = false;

      for (const query of currentSearchQueries) {
        try {
          const token = localStorage.getItem('token');
          if (!token) { queryError = "Authentication required."; break; }

          console.log(`ItemDetailPage: Searching with query: "${query}"`);
          const response = await fetch(`https://188.245.179.212/api/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.warn(`ItemDetailPage: Search failed for "${query}" - Status: ${response.status}, Detail: ${errorText}`);
            if (!fetchedAny) queryError = `Search for "${query}" failed.`;
            continue;
          }

          const data = await response.json();
          if (data.Results && data.Results.length > 0) {
            console.log(`ItemDetailPage: Found ${data.Results.length} results for: "${query}"`);
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
        const uniqueResults = Array.from(new Map(allResultsAccumulated.map(stream => [stream.MagnetUri || stream.Link || stream.Title, stream])).values());
        const formattedStreams = uniqueResults.map(stream => ({
          title: stream.Title,
          name: `${stream.Tracker || stream.Site || 'Unknown'} (${stream.Seeders || 0}S/${stream.Peers || 0}P)`,
          quality: stream.Title && typeof stream.Title === 'string' ?
                     (stream.Title.match(/4k|2160p|uhd/i) ? '4K' :
                      stream.Title.match(/1080p|fhd/i) ? '1080p' :
                      stream.Title.match(/720p|hd/i) ? '720p' :
                      stream.Title.match(/sd|480p|360p/i) ? 'SD' : 'N/A') : 'N/A',
          seeders: stream.Seeders || 0,
          peers: stream.Peers || 0,
          size: stream.Size ? (parseInt(stream.Size, 10) / 1024 / 1024 / 1024).toFixed(2) + ' GB' : 'N/A',
          magnetLink: stream.MagnetUri || stream.Link,
          publishDate: stream.PublishDate,
          tracker: stream.Tracker || stream.Site || 'Unknown',
        }));
        const sortedStreams = scoreAndSortTorrents(formattedStreams);
        setAllStreams(sortedStreams);
        setStreamError('');
      } else {
        setAllStreams([]);
        setStreamError(queryError || "No streams found after trying all queries.");
      }
      setIsLoadingStreams(false);
    };

    // Trigger torrent fetching if metadata is loaded AND (it's a movie OR an episode is selected) AND showTorrents is true
    if (metadata && showTorrents) {
        fetchTorrents();
    } else if (metadata && metadata.type === 'series' && !selectedEpisode && showTorrents) {
        // If showTorrents is true for a series but no episode is selected,
        // it means the main "Download" button for the series was clicked.
        // We might want to fetch "season pack" torrents here if the search supported it,
        // or simply show a message to select an episode. For now, do nothing or set a specific message.
        setStreamError("Select an episode to see its sources, or use a search for full season packs.");
        setAllStreams([]);
        setIsLoadingStreams(false);
    }


  }, [metadata, selectedEpisode, showTorrents]); // Key dependencies

  useEffect(() => {
    if (qualityFilter === 'All') setFilteredStreams(allStreams);
    else setFilteredStreams(allStreams.filter(s => s.quality && s.quality.toLowerCase().startsWith(qualityFilter.toLowerCase().replace('p',''))));
  }, [allStreams, qualityFilter]);

  const handleOpenSelectFolderModal = () => { /* ... (same as before) ... */ 
    if (!metadata || !metadata.id || !metadata.type) {
        showPopup("Item details not loaded yet.", "warning"); return;
      }
      if (allFolders.length === 0) {
        showPopup("No watchlists available. Create one first in 'My Lists'.", "info"); return;
      }
      setIsSelectFolderModalOpen(true);
  };
  const handlePlayTrailer = () => { /* ... (same as before) ... */ 
    const PLACEHOLDER_TRAILER_URL = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    let urlToPlay = PLACEHOLDER_TRAILER_URL;
    let message = "No specific trailer found. Playing a placeholder.";

    if (metadata && metadata.trailer) {
      if (metadata.trailer.startsWith('ytid:')) {
        urlToPlay = `https://www.youtube.com/watch?v=${metadata.trailer.substring(5)}`;
        message = `Playing trailer for ${metadata.name}`;
      } else if (metadata.trailer.startsWith('http')) {
        urlToPlay = metadata.trailer;
        message = `Playing trailer for ${metadata.name}`;
      }
    }
    showPopup(message, "info");
    setCurrentTrailerUrl(urlToPlay);
    setCurrentStreamType('direct');
    setIsPlayerModalOpen(true);
  };

  const handleEpisodeSelect = (episode) => {
    if (!episode.isReleased) { showPopup("This episode has not aired yet.", "info"); return; }
    setSelectedEpisode(episode);
    setShowTorrents(true); // Automatically show torrents when an episode is selected
    setQualityFilter('1080p');
    setAllStreams([]); // Clear previous episode/movie streams
  };

  const handleDownloadOrWatch = () => { // Generic handler for "Download" button
    if (metadata?.type === 'movie') {
      setShowTorrents(true); // Ensure torrents are shown for movie
      if (allStreams.length === 0 && !isLoadingStreams) { // If not already loaded, trigger fetch (though useEffect should handle it)
        //This explicit call might be redundant if the useEffect for torrent fetching is robust
      }
    } else if (metadata?.type === 'series' && selectedEpisode) {
      setShowTorrents(true); // Ensure torrents are shown for the selected episode
       if (allStreams.length === 0 && !isLoadingStreams) {
        //This explicit call might be redundant
      }
    } else if (metadata?.type === 'series' && !selectedEpisode) {
        showPopup("Please select an episode first to see download/streaming sources.", "info");
        // Optionally, you could trigger a search for "season packs" here if your backend supports it
        // For now, we guide the user.
    }
    setQualityFilter('1080p'); // Reset filter when showing sources
  };
  
  const handleBackToEpisodes = () => {
    setSelectedEpisode(null);
    setShowTorrents(false); // Hide torrents when going back to episode list
    setAllStreams([]);
    setFilteredStreams([]);
  };

  const handleStreamPlay = async (magnetLink, streamTitleFromTorrent) => { /* ... (same as before, with setActiveStreamMagnet) ... */ 
    setActiveStreamMagnet(magnetLink);
    let fullTitle = metadata?.name || "this item";
    if (selectedEpisode && metadata?.type === 'series') {
        const seasonNum = String(selectedEpisode.season).padStart(2, '0');
        const episodeNum = String(selectedEpisode.number || selectedEpisode.episode).padStart(2, '0');
        fullTitle = `${metadata.name} S${seasonNum}E${episodeNum}`;
    } else if (metadata?.type === 'movie') {
        fullTitle = metadata.name;
    }
    const displayTitle = streamTitleFromTorrent || fullTitle;
    showPopup(`Requesting stream: ${displayTitle}`, "info", 2000);

    if (!magnetLink) {
      showPopup("Magnet link is missing for this stream.", "warning");
      setActiveStreamMagnet(null);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showPopup("Authentication required.", "warning");
        setActiveStreamMagnet(null);
        return;
      }
      const response = await fetch('https://188.245.179.212/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ magnetLink, movieTitle: displayTitle })
      });
      const data = await response.json();
      if (response.ok && data.streamUrl) {
        let publicStreamUrl = data.streamUrl;
        if (data.streamType !== 'hls' && publicStreamUrl.includes('172.17.0.1:9000')) {
          publicStreamUrl = publicStreamUrl.replace('http://172.17.0.1:9000', 'https://188.245.179.212/admin/peerflix');
        }
        if (data.needsTranscoding) {
          showPopup(`Preparing stream for ${displayTitle}. This may take a moment...`, "info", 10000);
        } else {
          showPopup(`Stream ready for ${displayTitle}.`, "success", 3000);
        }
        setCurrentStreamType(data.streamType || 'direct');
        setCurrentTrailerUrl(publicStreamUrl);
        setIsPlayerModalOpen(true);
      } else {
        const errorText = data.error || "Failed to start stream.";
        const suggestion = data.suggestion || "";
        throw new Error(errorText + (suggestion ? ` Suggestion: ${suggestion}` : ""));
      }
    } catch (err) {
      console.error("Error starting stream:", err);
      showPopup(`Stream Error: ${err.message}`, "warning", 10000);
    } finally {
      setActiveStreamMagnet(null);
    }
  };

  const availableSeasonNumbers = Object.keys(regularSeasons).map(Number).sort((a, b) => a - b);
  const episodesForCurrentDisplay = selectedSeason === "specials" ? specialEpisodes : (regularSeasons[selectedSeason] || []);

  // Loading and error states
  if (isLoadingAddons && isLoadingMeta) return <div className="page-container"><div className="loading-message">Initializing & Loading...</div></div>;
  if (globalAddonErr && !metadata && !isLoadingMeta) return <div className="page-container"><div className="error-message global-error">{globalAddonErr}</div></div>;
  if (metaError && !isLoadingMeta && !metadata) return <div className="page-container"><div className="error-message global-error">{metaError}</div></div>;
  if (!metadata && !isLoadingMeta) return <div className="page-container"><div className="empty-message">Item not found or failed to load.</div></div>; // Generic if no specific error
  if (isLoadingMeta || !metadata) return <div className="page-container"><div className="loading-message">Loading item details...</div></div>; // Should be caught by previous one but as a fallback.

  // Determine if torrent section should be displayed
  const displayTorrentSection = showTorrents && (metadata.type === 'movie' || (metadata.type === 'series' && selectedEpisode));
  const displayEpisodeSection = metadata.type === 'series' && (availableSeasonNumbers.length > 0 || specialEpisodes.length > 0);

  // Determine Download button state
  const downloadButtonText = () => {
      if (isLoadingStreams) return "Loading Sources...";
      if (metadata.type === 'movie' && showTorrents) return "Select Source";
      if (metadata.type === 'series' && selectedEpisode && showTorrents) return "Select Source";
      return "Download";
  };
  const isDownloadButtonDisabled = () => {
      if (isLoadingStreams) return true;
      if (metadata.type === 'movie' && showTorrents) return true; // Already shown or loading
      if (metadata.type === 'series' && selectedEpisode && showTorrents) return true; // Already shown for this episode
      if (metadata.type === 'series' && !selectedEpisode && !showTorrents) return false; // Allow to click to show prompt
      return false;
  };


  return (
    <div className="page-container item-detail-page">
      <div className="detail-hero" style={{ backgroundImage: `linear-gradient(to top, rgba(var(--bg-primary-rgb, 14,16,21), 1) 5%, rgba(var(--bg-primary-rgb, 14,16,21), 0.9) 20%, rgba(var(--bg-primary-rgb, 14,16,21), 0.6) 45%, transparent 100%), url(${metadata.background || metadata.poster || ''})` }}>
        <div className="detail-hero-content-wrapper">
          <div className="detail-poster-container">
            <img src={metadata.poster || 'https://via.placeholder.com/300x450?text=No+Poster'} alt={metadata.name} className="detail-poster-image" />
          </div>
          <div className="detail-info-actions-container">
            <h1 className="detail-title">{metadata.name}</h1>
            <div className="detail-meta-row">
              {metadata.year && <span className="meta-item">{metadata.year}</span>}
              {metadata.runtime && <span className="meta-item">{metadata.runtime}</span>}
              {metadata.genres && metadata.genres.length > 0 && <span className="meta-item">{metadata.genres.slice(0, 3).join(', ')}</span>}
              {metadata.imdbRating && <span className="meta-item imdb-rating">★ {metadata.imdbRating}</span>}
            </div>
            <p className="detail-description">{metadata.description || 'No description available.'}</p>
            <div className="detail-actions">
              <button className="action-button primary" onClick={handlePlayTrailer}><PlayIcon /> Trailer</button>
              <button className="action-button secondary" onClick={handleOpenSelectFolderModal}><AddToListIcon /> Add to List</button>
              {/* Universal Download Button */}
              <button 
                className="action-button secondary" 
                onClick={handleDownloadOrWatch}
                disabled={isDownloadButtonDisabled()}
              >
                <DownloadIcon /> {downloadButtonText()}
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="page-main-content detail-page-body">
        {displayEpisodeSection && !selectedEpisode && !showTorrents && ( // Only show episode selection if torrents for series are not active
          <div className="detail-section series-content-section">
            {/* ... (episode selection JSX - same as before) ... */}
            <div className="seasons-episodes-container">
              <div className="seasons-tabs-container">
                <h2>Seasons</h2>
                <div className="seasons-tabs">
                  {availableSeasonNumbers.map(seasonNum => (<button key={seasonNum} className={`season-tab ${selectedSeason === seasonNum ? 'active' : ''}`} onClick={() => { setSelectedSeason(seasonNum); setSelectedEpisode(null); setShowTorrents(false); }}>Season {seasonNum}</button>))}
                  {specialEpisodes.length > 0 && (<button key="specials" className={`season-tab ${selectedSeason === "specials" ? 'active' : ''}`} onClick={() => { setSelectedSeason("specials"); setSelectedEpisode(null); setShowTorrents(false);}}>Specials</button>)}
                </div>
              </div>
              {selectedSeason && episodesForCurrentDisplay.length > 0 && (
                <div className="episodes-list-container">
                  <h2>{selectedSeason === "specials" ? "Special Episodes" : `Episodes - Season ${selectedSeason}`}</h2>
                  <div className="episodes-grid">
                    {episodesForCurrentDisplay.map(ep => (
                      <div key={ep.id || `${ep.season}-${ep.number}`} className={`episode-card ${!ep.isReleased ? 'not-aired' : ''} ${selectedEpisode?.id === ep.id ? 'active' : ''}`} onClick={() => ep.isReleased ? handleEpisodeSelect(ep) : showPopup("This episode has not aired yet.", "info")} title={!ep.isReleased ? "Not Aired Yet" : (ep.name || ep.title || `Episode ${ep.number}`)}>
                        {ep.thumbnail ? <img src={ep.thumbnail} alt={ep.name || ep.title || `Episode ${ep.number}`} className="episode-thumbnail"/> : <div className="episode-thumbnail-placeholder"><span>{ep.name || ep.title || `E${ep.number}`}</span></div>}
                        <div className="episode-info">
                          <h4 className="episode-title">E{ep.number || ep.episode}. {ep.name || ep.title || 'Untitled Episode'}</h4>
                          <p className="episode-overview-short">{ep.overview || 'No overview available.'}</p>
                          {!ep.isReleased && ep.released && <span className="episode-release-date">Airs: {new Date(ep.released).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedSeason && episodesForCurrentDisplay.length === 0 && (<p className="empty-message">No episodes found for this season.</p>)}
            </div>
          </div>
        )}
        
        {/* Torrent/Sources Section - now controlled by `displayTorrentSection` */}
        {displayTorrentSection && (
          <div className="detail-section streams-section">
            <div className="streams-header">
              <h2>
                {metadata.type === 'movie' ? `Sources for: ${metadata.name}` : 
                 (selectedEpisode ? `Sources for: ${metadata.name} - S${String(selectedEpisode.season).padStart(2, '0')}E${String(selectedEpisode.number || selectedEpisode.episode).padStart(2, '0')}` : `Sources for: ${metadata.name}`)}
              </h2>
              {metadata.type === 'series' && selectedEpisode && (<button onClick={handleBackToEpisodes} className="back-to-episodes-btn"><BackIcon /> Back to Episodes</button>)}
            </div>
            
            <div className="stream-filters">
              <label htmlFor="qualityFilter">Filter Quality:</label>
              <select id="qualityFilter" value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} className="quality-filter-select">
                {availableQualities.map(q => <option key={q} value={q}>{q === 'All' ? 'All Qualities' : q}</option>)}
              </select>
            </div>
            
            {isLoadingStreams && <div className="loading-message">Loading sources...</div>}
            {streamError && !isLoadingStreams && <div className="error-message">{streamError}</div>}
            {!isLoadingStreams && filteredStreams.length === 0 && !streamError && (<p className="empty-message">No sources found for this selection or quality filter.</p>)}
            {!isLoadingStreams && filteredStreams.length > 0 && (
              <ul className="stream-list">
                {filteredStreams.map((stream, index) => (
                  <li key={stream.magnetLink || `stream-${index}-${stream.title}`} className="stream-item">
                    <div className="stream-quality-indicator" data-quality={stream.quality?.toLowerCase() || 'unknown'}>{stream.quality?.substring(0,4) || 'N/A'}</div>
                    <div className="stream-info">
                      <span className="stream-title" title={stream.title}>{stream.title}</span>
                      <div className="stream-details">
                        {stream.seeders !== undefined && <span className="stream-seeders">Seeders: {stream.seeders}</span>}
                        {stream.peers !== undefined && <span className="stream-peers">Peers: {stream.peers}</span>}
                        {stream.size && <span className="stream-size">Size: {stream.size}</span>}
                      </div>
                    </div>
                    <button className="stream-play-button" onClick={() => handleStreamPlay(stream.magnetLink, stream.title)} disabled={!stream.magnetLink || activeStreamMagnet === stream.magnetLink}>
                      {activeStreamMagnet === stream.magnetLink ? 'Starting...' : 'Watch'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </main>
      {isSelectFolderModalOpen && metadata && (<SelectFolderModal isOpen={isSelectFolderModalOpen} onClose={() => setIsSelectFolderModalOpen(false)} folders={allFolders} itemId={metadata.id} itemType={metadata.type} itemTitle={metadata.name || "this item"}/>)}
      {metadata && (<MediaPlayerModal isOpen={isPlayerModalOpen} onClose={() => {setIsPlayerModalOpen(false); setCurrentTrailerUrl(''); setCurrentStreamType('direct');}} trailerUrl={currentTrailerUrl} streamType={currentStreamType} title={selectedEpisode ? `${metadata.name} - S${String(selectedEpisode.season).padStart(2, '0')}E${String(selectedEpisode.number).padStart(2, '0')}` : metadata?.name}/>)}
    </div>
  );
};

export default ItemDetailPage;