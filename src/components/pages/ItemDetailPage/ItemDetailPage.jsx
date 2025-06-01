// src/components/pages/ItemDetailPage/ItemDetailPage.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useNavigate
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
};

// Helper function to score and sort torrents
const scoreAndSortTorrents = (torrents) => {
}


const ItemDetailPage = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
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
    if (qualityFilter === 'All') setFilteredStreams(allStreams);
    else setFilteredStreams(allStreams.filter(s => s.quality && s.quality.toLowerCase().startsWith(qualityFilter.toLowerCase().replace('p',''))));
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
    let urlToPlay = null; // Initialize with null
    let message = "No trailer available for this item.";
    let foundTrailer = false;

    if (metadata && metadata.trailers && metadata.trailers.length > 0) {
      const firstTrailer = metadata.trailers.find(t => t.type === "Trailer" && t.source);
      
      if (firstTrailer && firstTrailer.source) {
        const youtubeId = firstTrailer.source;
        urlToPlay = `https://www.youtube.com/watch?v=${youtubeId}`;
        message = `Playing trailer for ${metadata.name}`;
        foundTrailer = true;
      }
    }
    
    // Fallback to single 'trailer' string if 'trailers' array didn't yield a result
    if (!foundTrailer && metadata && metadata.trailer && typeof metadata.trailer === 'string') {
      if (metadata.trailer.startsWith('ytid:')) {
        const youtubeId = metadata.trailer.substring(5);
        urlToPlay = `https://www.youtube.com/watch?v=${youtubeId}`;
        message = `Playing trailer for ${metadata.name}`;
        foundTrailer = true;
      } else if (metadata.trailer.startsWith('http')) {
        urlToPlay = metadata.trailer;
        message = `Playing trailer for ${metadata.name}`;
        foundTrailer = true;
      }
    }

    if (foundTrailer && urlToPlay) {
      showPopup(message, "info");
      setCurrentTrailerUrl(urlToPlay);
      setCurrentStreamType('direct'); 
      setIsPlayerModalOpen(true);
    } else {
      // If no trailer was found (urlToPlay is still null or the placeholder wasn't overridden)
      showPopup(message, "info"); // Inform the user that no trailer is available
      // Do not open the player modal
      setIsPlayerModalOpen(false);
      setCurrentTrailerUrl(''); 
    }
  };
  
  const handleBackToEpisodes = () => {
    setSelectedEpisode(null);
    setShowTorrents(false);
    setAllStreams([]);
    setFilteredStreams([]);
  };

  const availableSeasonNumbers = Object.keys(regularSeasons).map(Number).sort((a, b) => a - b);
  const episodesForCurrentDisplay = selectedSeason === "specials" ? specialEpisodes : (regularSeasons[selectedSeason] || []);

  if (isLoadingAddons && isLoadingMeta) return <div className="page-container"><div className="loading-message">Initializing & Loading...</div></div>;
  if (globalAddonErr && !metadata && !isLoadingMeta) return <div className="page-container"><div className="error-message global-error">{globalAddonErr}</div></div>;
  if (metaError && !isLoadingMeta && !metadata) return <div className="page-container"><div className="error-message global-error">{metaError}</div></div>;
  if (!metadata && !isLoadingMeta) return <div className="page-container"><div className="empty-message">Item not found or failed to load.</div></div>;
  if (isLoadingMeta || !metadata) return <div className="page-container"><div className="loading-message">Loading item details...</div></div>;

  const displayTorrentSection = showTorrents && (metadata.type === 'movie' || (metadata.type === 'series' && selectedEpisode));
  const displayEpisodeSection = metadata.type === 'series' && (availableSeasonNumbers.length > 0 || specialEpisodes.length > 0);

  const downloadButtonText = () => {
      if (isLoadingStreams) return "Loading Sources...";
      if (metadata.type === 'movie' && showTorrents) return "Select Source";
      if (metadata.type === 'series' && selectedEpisode && showTorrents) return "Select Source";
      return "Watch / Download";
  };

  const isDownloadButtonDisabled = () => {
      if (isLoadingStreams) return true;
      if (showTorrents && allStreams.length > 0) return true; 
      if (metadata.type === 'series' && !selectedEpisode && !showTorrents) return false; 
      return false;
  };

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
              {metadata.year && <span className="meta-item">{metadata.year}</span>}
              {metadata.runtime && <span className="meta-item">{metadata.runtime}</span>}
              {metadata.genres && metadata.genres.length > 0 && <span className="meta-item">{metadata.genres.slice(0, 3).join(', ')}</span>}
              {metadata.imdbRating && <span className="meta-item imdb-rating">★ {metadata.imdbRating}</span>}
            </div>
            <p className="detail-description">{metadata.description || 'No description available.'}</p>
            <div className="detail-actions">
              <button className="action-button primary" onClick={handlePlayTrailer}><PlayIcon /> Trailer</button>
              <button className="action-button secondary" onClick={handleOpenSelectFolderModal}><AddToListIcon /> Add to List</button>
              {/* no download button, implement in future version */}
            </div>
          </div>
        </div>
      </div>

      <main className="page-main-content detail-page-body">
        {displayEpisodeSection && !selectedEpisode && !showTorrents && (
          <div className="detail-section series-content-section">
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
      {metadata && currentTrailerUrl && (
        <div>
          {/* media player */}
        </div>
      )}
    </div>
  );
};

export default ItemDetailPage;