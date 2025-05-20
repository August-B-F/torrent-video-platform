// src/components/pages/ItemDetailPage/ItemDetailPage.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import { useWatchlist } from '../../contexts/WatchlistContext';
import SelectFolderModal from '../Watchlist/SelectFolderModal';
import { usePopup } from '../../contexts/PopupContext';
import MediaPlayerModal from '../../common/MediaPlayerModal/MediaPlayerModal';
import './ItemDetailPage.css';

// SVG Icons (assuming they are defined as before)
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
  // Removed addItemToFolder, folders from here, as SelectFolderModal will use context directly
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
  const [qualityFilter, setQualityFilter] = useState('1080p');
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
      if (!cinemeta) {
        setMetaError('Cinemeta addon not available.'); setIsLoadingMeta(false); return;
      }
      try {
        const fetchedMeta = await fetchItemDetailsFromContext(id, type);
        if (fetchedMeta && fetchedMeta.name) {
          setMetadata(fetchedMeta);
          if (fetchedMeta.type === 'series') {
            const processed = processVideos(fetchedMeta.videos || []);
            const firstRegularSeason = Object.keys(processed.regularSeasons).map(Number).sort((a, b) => a - b)[0];
            if (firstRegularSeason) {
              setSelectedSeason(firstRegularSeason);
            } else if (processed.specialEpisodes.length > 0) {
              setSelectedSeason("specials");
            }
          }
        } else {
          setMetaError(`Failed to load metadata.`);
        }
      } catch (e) {
        setMetaError(`Failed to load metadata: ${e.message}.`);
      } finally {
        setIsLoadingMeta(false);
      }
    };
    fetchMeta();
  }, [cinemeta, type, id, isLoadingAddons, fetchItemDetailsFromContext, processVideos]);

  useEffect(() => {
    const shouldFetchMovieTorrents = metadata?.type === 'movie' && showMovieTorrents;
    const shouldFetchEpisodeTorrents = metadata?.type === 'series' && selectedEpisode;

    if (!shouldFetchMovieTorrents && !shouldFetchEpisodeTorrents) {
      setAllStreams([]); return;
    }

    setIsLoadingStreams(true);
    setStreamError('');
    setAllStreams([]);

    let streamTitleInfo = metadata.name;
    if(shouldFetchEpisodeTorrents && selectedEpisode) {
        streamTitleInfo = `${metadata.name} - S${selectedEpisode.season || '0'}E${selectedEpisode.number || selectedEpisode.episode}`;
    }

    setTimeout(() => {
      const placeholderTorrents = [
        { title: `${streamTitleInfo} (1080p WEB-DL)`, name: "TorrentSourceX (1080p)", quality: "1080p", seeders: 180, size: "2.2 GB" },
        { title: `${streamTitleInfo} (720p HDTV)`, name: "TorrentSourceY (720p)", quality: "720p", seeders: 95, size: "900 MB"  },
        { title: `${streamTitleInfo} (4K REMUX)`, name: "TorrentSourceZ (4K)", quality: "4K", seeders: 50, size: "15.5 GB"  },
        { title: `${streamTitleInfo} (1080p BluRay)`, name: "TorrentSourceA (1080p)", quality: "1080p", seeders: 250, size: "8.1 GB" },
        { title: `${streamTitleInfo} (SD CAM)`, name: "TorrentSourceB (SD)", quality: "SD", seeders: 30, size: "700 MB" },
      ];
      setAllStreams(placeholderTorrents);
      setIsLoadingStreams(false);
    }, 1000);

  }, [selectedEpisode, metadata, showMovieTorrents]);

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
      if (allFolders.length === 0) { // Use allFolders from context
        showPopup("No watchlists available. Create one first in 'My Lists'.", "info"); return;
      }
      setIsSelectFolderModalOpen(true);
  };

  // This function might not be needed if the modal handles everything via context
  const handleModalFolderSelectionConfirm = (selectedIds) => {
    // The SelectFolderModal now calls context functions directly.
    // This callback could be used for additional actions AFTER the modal has done its work.
    // For instance, to show a specific confirmation message here.
    // For now, we can simplify or remove it if the modal's internal logic is sufficient.
    console.log("Folder selection confirmed in ItemDetailPage for item:", metadata.id, "with folders:", selectedIds);
    // Example: showPopup("Watchlist updated.", "success"); // (Modal might do this already)
  };

  const handlePlayTrailer = () => {
    const PLACEHOLDER_TRAILER_URL = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    let urlToPlay = PLACEHOLDER_TRAILER_URL;
    let message = "No specific trailer found. Playing a placeholder.";

    if (metadata && metadata.trailer) {
      if (metadata.trailer.startsWith('ytid:')) {
        urlToPlay = `https://www.youtube.com/watch?v=` + metadata.trailer.substring(5); // Correct YouTube URL
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

  const availableSeasonNumbers = Object.keys(regularSeasons).map(Number).sort((a, b) => a - b);
  const episodesForCurrentDisplay = selectedSeason === "specials" ? specialEpisodes : (regularSeasons[selectedSeason] || []);


  if (isLoadingAddons && isLoadingMeta) return <div className="page-container"><div className="loading-message">Initializing addons & loading details...</div></div>;
  if (!metadata) return <div className="page-container"><div className="empty-message">Item details could not be loaded.</div></div>;


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
                selectedEpisode ? `Torrents for: ${metadata.name} - S${selectedEpisode.season || '0'}E${selectedEpisode.number || selectedEpisode.episode}` : "Torrents"}
                </h2>
                {metadata.type === 'series' && selectedEpisode && (
                    <button onClick={handleBackToEpisodes} className="back-to-episodes-btn">
                        <BackIcon /> Back to Episodes
                    </button>
                )}
             </div>
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

            {isLoadingStreams && <div className="loading-message">Loading torrents...</div>}
            {streamError && <div className="error-message">{streamError}</div>}
            {!isLoadingStreams && filteredStreams.length === 0 && !streamError && (
              <p className="empty-message">No torrents found for this selection or quality filter.</p>
            )}
            {!isLoadingStreams && filteredStreams.length > 0 && (
              <ul className="stream-list">
                {filteredStreams.map((stream, index) => (
                  <li key={index} className="stream-item">
                    <div className="stream-quality-indicator" data-quality={stream.quality?.toLowerCase() || 'unknown'}>
                        {stream.quality?.substring(0,4) || 'N/A'}
                    </div>
                    <div className="stream-info">
                        <span className="stream-title">{stream.name || stream.title}</span>
                        <div className="stream-details">
                            {stream.seeders !== undefined && <span className="stream-seeders">Seeders: {stream.seeders}</span>}
                            {stream.size && <span className="stream-size">Size: {stream.size}</span>}
                        </div>
                    </div>
                    <button className="stream-play-button" onClick={() => showPopup(`Playback of "${stream.title}" not implemented.`, "info")}>
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
          folders={allFolders} // Pass all folders from context
          // onItemAddMultiple={handleModalFolderSelectionConfirm} // This prop can be re-evaluated
          itemId={metadata.id} // Pass current item ID
          itemType={metadata.type} // Pass current item type
          itemTitle={metadata.name || "this item"}
        />
      )}
      {metadata && (
        <MediaPlayerModal
          isOpen={isPlayerModalOpen}
          onClose={() => setIsPlayerModalOpen(false)}
          trailerUrl={currentTrailerUrl}
          title={`Trailer: ${metadata.name}`}
        />
      )}
    </div>
  );
};

export default ItemDetailPage;