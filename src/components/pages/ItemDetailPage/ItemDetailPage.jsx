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

  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [showMovieTorrents, setShowMovieTorrents] = useState(false);
  const [qualityFilter, setQualityFilter] = useState('1080p'); // Default quality filter
  const availableQualities = useMemo(() => ['All', '4K', '1080p', '720p', 'SD'], []);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const processVideos = useCallback((videos) => {
    const regularSeasons = {};
    const specialEpisodes = [];

    videos.forEach(video => {
      const seasonNum = video.season;
      const episodeNum = video.number || video.episode;
      const isReleased = video.released ? new Date(video.released) <= new Date(today) : true;

      const episodeData = { ...video, number: episodeNum, isReleased };

      if (seasonNum && seasonNum > 0) {
        if (!regularSeasons[seasonNum]) {
          regularSeasons[seasonNum] = [];
        }
        regularSeasons[seasonNum].push(episodeData);
      } else {
        specialEpisodes.push(episodeData);
      }
    });

    Object.keys(regularSeasons).forEach(seasonNum => {
      regularSeasons[seasonNum].sort((a, b) => (a.number || 0) - (b.number || 0));
    });
    specialEpisodes.sort((a,b) => (a.number || 0) - (b.number || 0));

    return { regularSeasons, specialEpisodes };
  }, [today]);

  const { regularSeasons, specialEpisodes } = useMemo(() => {
    if (metadata?.type === 'series' && metadata.videos) {
      return processVideos(metadata.videos);
    }
    return { regularSeasons: {}, specialEpisodes: [] };
  }, [metadata, processVideos]);


  useEffect(() => {
    window.scrollTo(0, 0);
    setIsLoadingMeta(true);
    setMetaError('');
    setMetadata(null);
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setAllStreams([]);
    setFilteredStreams([]);
    setShowMovieTorrents(false);
    setQualityFilter('1080p');


    if (isLoadingAddons || !id || !type) return;

    const fetchMeta = async () => {
      if (!cinemeta && !globalAddonErr) { 
        setMetaError('Cinemeta addon not available. Please configure it in settings.'); 
        setIsLoadingMeta(false); 
        return;
      }
      if (globalAddonErr) { 
        setMetaError(`Cinemeta Addon Error: ${globalAddonErr}`);
        setIsLoadingMeta(false);
        return;
      }
      try {
        const fetchedMeta = await fetchItemDetailsFromContext(id, type);
        if (fetchedMeta && fetchedMeta.name) {
          setMetadata(fetchedMeta);
          if (fetchedMeta.type === 'series' && fetchedMeta.videos && fetchedMeta.videos.length > 0) {
            const processed = processVideos(fetchedMeta.videos);
            const firstRegularSeason = Object.keys(processed.regularSeasons).map(Number).sort((a, b) => a - b)[0];
            if (firstRegularSeason) {
              setSelectedSeason(firstRegularSeason);
            } else if (processed.specialEpisodes.length > 0) {
              setSelectedSeason("specials");
            }
          }
        } else {
          setMetaError(`Failed to load metadata for ${type} ID ${id}.`);
        }
      } catch (e) {
        console.error("Error fetching metadata in ItemDetailPage:", e);
        setMetaError(`Failed to load metadata: ${e.message}.`);
      } finally {
        setIsLoadingMeta(false);
      }
    };
    fetchMeta();
  }, [cinemeta, type, id, isLoadingAddons, fetchItemDetailsFromContext, processVideos, globalAddonErr]);

  // Effect for fetching torrents
  useEffect(() => {
    const fetchTorrents = async () => {
      if (!metadata || (!showMovieTorrents && !selectedEpisode)) {
        setAllStreams([]);
        setFilteredStreams([]);
        return;
      }

      setIsLoadingStreams(true);
      setStreamError('');
      setAllStreams([]);
      setFilteredStreams([]);

      let searchQueries = [];
      if (metadata.type === 'series' && selectedEpisode) {
        const seasonNum = selectedEpisode.season;
        const episodeNum = selectedEpisode.number || selectedEpisode.episode;
        const seasonPadded = String(seasonNum).padStart(2, '0');
        const episodePadded = String(episodeNum).padStart(2, '0');
        // Try multiple search formats for TV shows (most to least specific)
        const baseName = metadata.name.replace(/[:\-–]/g, ' ').replace(/\s+/g, ' ').trim();

        searchQueries = [
          `${baseName} S${seasonPadded}E${episodePadded}`,           // "Fallout S01E01"
          `${baseName} ${seasonNum}x${episodeNum}`,                  // "Fallout 1x1"
          `${baseName} Season ${seasonNum} Episode ${episodeNum}`,   // "Fallout Season 1 Episode 1"
          `${baseName} S${seasonNum}E${episodeNum}`,                 // "Fallout S1E1"
          `${baseName} ${metadata.year || ''} S${seasonPadded}E${episodePadded}`.trim(), // "Fallout 2024 S01E01"
        ];
      } else if (metadata.type === 'movie') { // Ensure this branch is only for movies
        // Movie search
        let movieSearch = metadata.name;
        if (metadata.year) {
          movieSearch += ` ${metadata.year}`;
        }
        movieSearch = movieSearch.replace(/[:\-–]/g, ' ').replace(/\s+/g, ' ').trim();
        searchQueries = [movieSearch];
      } else {
        // If it's neither a movie nor a series with a selected episode, don't search
        setIsLoadingStreams(false);
        return;
      }

      // Try each search query until we find results
      let allResults = [];
      let queryError = null; // Store the last error if all queries fail

      for (const query of searchQueries) {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            queryError = "Authentication required to search for streams.";
            setIsLoadingStreams(false);
            // setStreamError needs to be outside the loop or handled after loop if all fail
            break; // Stop if no token
          }
          console.log(`Trying search query: "${query}"`);
          const response = await fetch(`https://188.245.179.212/api/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorDetail = errorText;
             try {
                const errorJson = JSON.parse(errorText);
                if (errorJson && errorJson.error) {
                    errorDetail = errorJson.error;
                }
            } catch (e) {
                console.warn(`Search query "${query}" failed, response not JSON:`, errorText);
            }
            console.warn(`Search failed for query: "${query}" - Status: ${response.status}, Detail: ${errorDetail}`);
            queryError = `Search for "${query}" failed. Status: ${response.status}.`; // Store the last error
            continue; // Try next query
          }

          const data = await response.json();
          if (data.Results && data.Results.length > 0) {
            console.log(`Found ${data.Results.length} results for: "${query}"`);
            allResults = data.Results;
            queryError = null; // Reset error if results are found
            break; // Stop on first successful search
          } else {
            console.log(`No results for: "${query}"`);
            queryError = `No results found for "${query}".`; // Store message if no results
          }
        } catch (e) {
          console.warn(`Error with query "${query}":`, e);
          queryError = `Error processing query "${query}": ${e.message}.`; // Store the error
          continue; // Try next query
        }
      }

      // Process results
      if (allResults.length > 0) {
        const formattedStreams = allResults.map(stream => ({
          title: stream.Title,
          name: `${stream.Tracker || stream.Site || 'Unknown'} (${stream.Seeders}S/${stream.Peers}P)`,
          // Adjusted quality detection to be more robust
          quality: stream.Title && typeof stream.Title === 'string' ?
                   (stream.Title.match(/4K|2160p/i) ? '4K' :
                    stream.Title.match(/1080p/i) ? '1080p' :
                    stream.Title.match(/720p/i) ? '720p' : 'SD') : 'N/A',
          seeders: stream.Seeders,
          peers: stream.Peers,
          size: stream.Size ? (stream.Size / 1024 / 1024 / 1024).toFixed(2) + ' GB' : 'N/A',
          magnetLink: stream.MagnetUri,
          publishDate: stream.PublishDate,
        }));
        setAllStreams(formattedStreams);
        setStreamError(''); // Clear any previous error
      } else {
        // If no results from any query, set the error message
        setStreamError(queryError || `No streams found. Tried: ${searchQueries.join(', ')}`);
      }
      setIsLoadingStreams(false);
    };

    if (metadata && (showMovieTorrents || selectedEpisode)) {
        fetchTorrents();
    }
  }, [metadata, selectedEpisode, showMovieTorrents, id]);

  useEffect(() => {
    if (qualityFilter === 'All') {
      setFilteredStreams(allStreams);
    } else {
      setFilteredStreams(allStreams.filter(stream => stream.quality && stream.quality.toLowerCase().includes(qualityFilter.toLowerCase())));
    }
  }, [allStreams, qualityFilter]);

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
    setIsPlayerModalOpen(true);
  };


  const handleEpisodeSelect = (episode) => {
    if (!episode.isReleased) {
        showPopup("This episode has not aired yet.", "info");
        return;
    }
    setSelectedEpisode(episode);
    setShowMovieTorrents(false); 
    setQualityFilter('1080p'); 
  };

  const handleMovieWatchNow = () => {
    setShowMovieTorrents(true);
    setSelectedEpisode(null); 
    setQualityFilter('1080p'); 
  };
  
  const handleBackToEpisodes = () => {
      setSelectedEpisode(null);
      setAllStreams([]); 
      setFilteredStreams([]);
  };
  
  const handleStreamPlay = async (magnetLink, streamTitleFromTorrent) => {
    let fullTitle = metadata?.name || "this item";
    if (selectedEpisode && metadata?.type === 'series') {
        const seasonNum = String(selectedEpisode.season).padStart(2, '0');
        const episodeNum = String(selectedEpisode.number || selectedEpisode.episode).padStart(2, '0');
        fullTitle = `${metadata.name} S${seasonNum}E${episodeNum}`;
    } else if (metadata?.type === 'movie') {
        fullTitle = metadata.name;
    }
    // Use a more descriptive title if possible, or fallback
    const displayTitle = streamTitleFromTorrent || fullTitle;


    showPopup(`Attempting to stream: ${displayTitle}`, "info");
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showPopup("Authentication required to start stream.", "warning");
        return;
      }
      const response = await fetch('https://188.245.179.212/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ magnetLink, movieTitle: displayTitle }) 
      });
      
      const data = await response.json();
      if (response.ok && data.streamUrl) {
        console.log("Stream started, URL from backend:", data.streamUrl);
        
        // Convert internal URL to public URL accessible through Caddy
        const publicStreamUrl = data.streamUrl.replace(
          'http://172.17.0.1:9000', 
          'https://188.245.179.212/admin/peerflix'
        );
        
        console.log("Public stream URL:", publicStreamUrl);
        
        showPopup(`Stream ready for ${displayTitle}.`, "success", 7000);
        setCurrentTrailerUrl(publicStreamUrl); 
        setIsPlayerModalOpen(true);
  
      } else {
        const errorText = data.error || "Failed to start stream.";
        throw new Error(errorText);
      }
    } catch (err) {
      console.error("Error starting stream:", err);
      showPopup(`Error starting stream: ${err.message}`, "warning");
    }
  };


  const availableSeasonNumbers = Object.keys(regularSeasons).map(Number).sort((a, b) => a - b);
  const episodesForCurrentDisplay = selectedSeason === "specials" ? specialEpisodes : (regularSeasons[selectedSeason] || []);


  if (isLoadingAddons && isLoadingMeta) return <div className="page-container"><div className="loading-message">Initializing addons & loading details...</div></div>;
  if (globalAddonErr && !metadata) return <div className="page-container"><div className="error-message global-error" style={{textAlign:'center', padding: '20px'}}>{globalAddonErr} Please check Addon Settings.</div></div>;
  if (!metadata && !isLoadingMeta) return <div className="page-container"><div className="empty-message">Item details could not be loaded. Ensure Cinemeta is configured correctly.</div></div>;
  if (!metadata && metaError) return <div className="page-container"><div className="error-message global-error" style={{textAlign:'center', padding: '20px'}}>{metaError}</div></div>;
  if (!metadata) return <div className="page-container"><div className="loading-message">Loading item details...</div></div>; 


  const displayTorrentSection = (metadata.type === 'movie' && showMovieTorrents) || (metadata.type === 'series' && selectedEpisode);
  const displayEpisodeSection = metadata.type === 'series' && (availableSeasonNumbers.length > 0 || specialEpisodes.length > 0);

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
              {metadata.genres && metadata.genres.length > 0 && (
                <span className="meta-item">{metadata.genres.slice(0, 3).join(', ')}</span>
              )}
              {metadata.imdbRating && <span className="meta-item imdb-rating">★ {metadata.imdbRating}</span>}
            </div>
            <p className="detail-description">{metadata.description || 'No description available.'}</p>
            <div className="detail-actions">
              <button className="action-button primary" onClick={handlePlayTrailer}>
                <PlayIcon /> Trailer
              </button>
              <button className="action-button secondary" onClick={handleOpenSelectFolderModal}>
                <AddToListIcon /> Add to List
              </button>
              {metadata.type === 'movie' && (
                <button className="action-button secondary" onClick={handleMovieWatchNow}>
                  <DownloadIcon /> Watch Now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="page-main-content detail-page-body">
        {displayEpisodeSection && !selectedEpisode && (
          <div className="detail-section series-content-section">
            <div className="seasons-episodes-container">
                <div className="seasons-tabs-container">
                    <h2>Seasons</h2>
                    <div className="seasons-tabs">
                    {availableSeasonNumbers.map(seasonNum => (
                        <button
                        key={seasonNum}
                        className={`season-tab ${selectedSeason === seasonNum ? 'active' : ''}`}
                        onClick={() => { setSelectedSeason(seasonNum); setSelectedEpisode(null); }}
                        >
                        Season {seasonNum}
                        </button>
                    ))}
                    {specialEpisodes.length > 0 && (
                        <button
                            key="specials"
                            className={`season-tab ${selectedSeason === "specials" ? 'active' : ''}`}
                            onClick={() => { setSelectedSeason("specials"); setSelectedEpisode(null); }}
                        >
                            Specials
                        </button>
                    )}
                    </div>
                </div>

                {selectedSeason && episodesForCurrentDisplay.length > 0 && (
                <div className="episodes-list-container">
                    <h2>
                        {selectedSeason === "specials" ? "Special Episodes" : `Episodes - Season ${selectedSeason}`}
                    </h2>
                    <div className="episodes-grid">
                        {episodesForCurrentDisplay.map(ep => (
                        <div
                            key={ep.id || `${ep.season}-${ep.number}`}
                            className={`episode-card ${!ep.isReleased ? 'not-aired' : ''} ${selectedEpisode?.id === ep.id ? 'active' : ''}`}
                            onClick={() => ep.isReleased ? handleEpisodeSelect(ep) : showPopup("This episode has not aired yet.", "info")}
                            title={!ep.isReleased ? "Not Aired Yet" : (ep.name || ep.title || `Episode ${ep.number}`)}
                        >
                            {ep.thumbnail ? (
                                <img
                                src={ep.thumbnail}
                                alt={ep.name || ep.title || `Episode ${ep.number}`}
                                className="episode-thumbnail"
                                />
                            ) : (
                                <div className="episode-thumbnail-placeholder">
                                    <span>{ep.name || ep.title || `E${ep.number}`}</span>
                                </div>
                            )}
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
                 {selectedSeason && episodesForCurrentDisplay.length === 0 && (
                    <p className="empty-message">No episodes found for this season.</p>
                 )}
            </div>
          </div>
        )}

        {displayTorrentSection && (
          <div className="detail-section streams-section">
             <div className="streams-header">
                <h2>
                {metadata.type === 'movie' ? `Torrents for: ${metadata.name}` :
                selectedEpisode ? `Torrents for: ${metadata.name} - S${String(selectedEpisode.season).padStart(2, '0')}E${String(selectedEpisode.number || selectedEpisode.episode).padStart(2, '0')}` : "Select an Episode"}
                </h2>
                {metadata.type === 'series' && selectedEpisode && (
                    <button onClick={handleBackToEpisodes} className="back-to-episodes-btn">
                        <BackIcon /> Back to Episodes
                    </button>
                )}
             </div>
             { (metadata.type === 'movie' || selectedEpisode) && 
                <div className="stream-filters">
                    <label htmlFor="qualityFilter">Filter Quality:</label>
                    <select
                        id="qualityFilter"
                        value={qualityFilter}
                        onChange={(e) => setQualityFilter(e.target.value)}
                        className="quality-filter-select"
                    >
                        {availableQualities.map(q => <option key={q} value={q}>{q === 'All' ? 'All Qualities' : q}</option>)}
                    </select>
                </div>
             }

            {isLoadingStreams && <div className="loading-message">Loading streams...</div>}
            {streamError && <div className="error-message">{streamError}</div>}
            {!isLoadingStreams && filteredStreams.length === 0 && !streamError && (metadata.type === 'movie' || selectedEpisode) && (
              <p className="empty-message">No streams found for this selection or quality filter.</p>
            )}
            {!isLoadingStreams && filteredStreams.length > 0 && (
              <ul className="stream-list">
                {filteredStreams.map((stream, index) => (
                  <li key={stream.magnetLink || `stream-${index}`} className="stream-item">
                    <div className="stream-quality-indicator" data-quality={stream.quality?.toLowerCase() || 'unknown'}>
                        {stream.quality?.substring(0,4) || 'N/A'}
                    </div>
                    <div className="stream-info">
                        <span className="stream-title" title={stream.title}>{stream.title}</span>
                        <div className="stream-details">
                            {stream.seeders !== undefined && <span className="stream-seeders">Seeders: {stream.seeders}</span>}
                            {stream.peers !== undefined && <span className="stream-peers">Peers: {stream.peers}</span>}
                            {stream.size && <span className="stream-size">Size: {stream.size}</span>}
                            {stream.publishDate && <span className="stream-publish-date">Published: {new Date(stream.publishDate).toLocaleDateString()}</span>}
                        </div>
                    </div>
                    <button 
                        className="stream-play-button" 
                        onClick={() => handleStreamPlay(stream.magnetLink, stream.title)}
                        disabled={!stream.magnetLink}
                    >
                        Watch
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
      {metadata && (
        <MediaPlayerModal
          isOpen={isPlayerModalOpen}
          onClose={() => {setIsPlayerModalOpen(false); setCurrentTrailerUrl('');}}
          trailerUrl={currentTrailerUrl}
          title={currentTrailerUrl.includes('youtube.com') || currentTrailerUrl.includes('youtu.be') ? `Trailer: ${metadata.name}` : `Streaming: ${metadata.name}`}
        />
      )}
    </div>
  );
};

export default ItemDetailPage;