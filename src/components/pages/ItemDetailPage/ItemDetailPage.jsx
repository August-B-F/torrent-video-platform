import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import { useWatchlist } from '../../contexts/WatchlistContext';
import SelectFolderModal from '../Watchlist/SelectFolderModal'; // Import the new modal
import { usePopup } from '../../contexts/PopupContext'; // Import usePopup
import './ItemDetailPage.css';

const ItemDetailPage = () => {
  const { type, id } = useParams();
  const { cinemeta, isLoadingAddons, cinemetaError: globalAddonErr } = useAddons();
  const { addItemToFolder, folders, itemDetailsCache, fetchItemDetails: fetchItemDetailsFromContext } = useWatchlist(); // Renamed to avoid conflict
  const { showPopup } = usePopup(); // Use the popup context

  const [metadata, setMetadata] = useState(null);
  const [streams, setStreams] = useState([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [streamError, setStreamError] = useState('');
  const [isSelectFolderModalOpen, setIsSelectFolderModalOpen] = useState(false);


  useEffect(() => {
    window.scrollTo(0, 0);
    if (isLoadingAddons || !id || !type) return;

    const fetchMeta = async () => {
      setIsLoadingMeta(true);
      setMetaError('');
      setMetadata(null); // Clear previous metadata

      if (!cinemeta) {
        setMetaError('Cinemeta addon not available. Please configure it in settings.');
        setIsLoadingMeta(false);
        return;
      }
      try {
        // console.log(`Workspaceing metadata for type: ${type}, id: ${id}`);
        // Use the fetchItemDetails from context which includes caching
        const fetchedMeta = await fetchItemDetailsFromContext(id, type);
        if (fetchedMeta && fetchedMeta.name) { // Check if valid metadata was returned
            setMetadata(fetchedMeta);
        } else {
            setMetaError(`Failed to load metadata. Item not found or addon error.`);
        }
      } catch (e) {
        console.error('Error fetching metadata from Cinemeta:', e);
        setMetaError(`Failed to load metadata: ${e.message}.`);
      } finally {
        setIsLoadingMeta(false);
      }
    };

    fetchMeta();
  }, [cinemeta, type, id, isLoadingAddons, fetchItemDetailsFromContext]); // Added fetchItemDetailsFromContext

  useEffect(() => {
    // This effect is for fetching streams, which is currently stubbed out.
    // Ensure it doesn't run unnecessarily or cause errors if metadata is not yet loaded.
    if (isLoadingAddons || !metadata || !type || !id ) {
        if (metadata === null && !isLoadingMeta && !metaError) { // Only set stream error if meta loading finished and failed silently
             setStreamError("Cannot fetch streams without item metadata.");
        }
        setIsLoadingStreams(false);
        return;
    }
    // For this example, we are skipping Torrentio and stream fetching.
    setIsLoadingStreams(false);
    // setStreamError("Stream provider (e.g., Torrentio) not configured for this session.");
  }, [isLoadingAddons, metadata, type, id, isLoadingMeta, metaError]);


  const handleOpenSelectFolderModal = () => {
    if (!metadata || !metadata.id || !metadata.type) {
        showPopup("Item details not loaded yet.", "warning");
        return;
    }
    if (folders.length === 0) {
        showPopup("No watchlists available. Create one first in 'My Lists'.", "info");
        return;
    }
    setIsSelectFolderModalOpen(true);
  };

  const handleAddItemToSelectedFolders = (selectedFolderIds) => {
    if (!metadata || !metadata.id || !metadata.type) {
        showPopup("Cannot add item: details are missing.", "warning");
        return;
    }
    if (selectedFolderIds.length === 0) {
        // This case should ideally be handled by disabling the button in the modal
        showPopup("No lists selected.", "info");
        return;
    }
    addItemToFolder(metadata.id, metadata.type, selectedFolderIds);
    // Popup for success/failure is now handled within addItemToFolder in WatchlistContext
  };


  if (isLoadingAddons && isLoadingMeta) return <div className="page-container"><div className="loading-message">Initializing addons & loading details...</div></div>;
  if (isLoadingAddons) return <div className="page-container"><div className="loading-message">Initializing addons...</div></div>;
  if (isLoadingMeta) return <div className="page-container"><div className="loading-message">Loading item details...</div></div>;
  
  if (globalAddonErr && !cinemeta) return <div className="page-container"><div className="error-message global-error">{globalAddonErr} Try configuring addons in Settings.</div></div>;
  if (metaError) return <div className="page-container"><div className="error-message">{metaError}</div></div>;
  if (!metadata) return <div className="page-container"><div className="empty-message">Item details could not be loaded for Type: {type}, ID: {id}. This might be an invalid ID or an issue with the Cinemeta addon.</div></div>;

  return (
    <div className="page-container item-detail-page">
      <main className="page-main-content">
        <div className="detail-hero" style={{backgroundImage: `linear-gradient(to top, rgba(var(--bg-primary-rgb, 14,16,21), 1) 15%, rgba(var(--bg-primary-rgb, 14,16,21), 0.85) 40%, rgba(var(--bg-primary-rgb, 14,16,21), 0.3) 70%, transparent 100%), url(${metadata.background || metadata.poster || 'https://via.placeholder.com/1920x1080?text=No+Background'})`}}>
            <div className="detail-hero-overlay">
                <div className="detail-header">
                <img src={metadata.poster || 'https://via.placeholder.com/300x450?text=No+Poster'} alt={metadata.name} className="detail-poster" />
                <div className="detail-info">
                    <h1 className="detail-title">{metadata.name}</h1>
                    <div className="detail-meta-row">
                    {metadata.year && <span className="meta-year">{metadata.year}</span>}
                    {metadata.runtime && <span className="meta-runtime">{metadata.runtime}</span>}
                    {metadata.genres && metadata.genres.length > 0 && (
                        <span className="meta-genres">{metadata.genres.join(', ')}</span>
                    )}
                    {/* Example for certification, adjust based on your metadata structure */}
                    {/* metadata.certification && <span className="meta-certification">{metadata.certification}</span> */}
                    </div>
                    {metadata.imdbRating && <p className="detail-rating">★ {metadata.imdbRating} <span className="rating-source">IMDb</span></p>}
                    
                    <p className="detail-description">{metadata.description || 'No description available.'}</p>
                    <div className="detail-actions">
                        <button className="hero-button primary" onClick={() => showPopup("Playback not implemented yet.", "info")}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            Play Trailer
                        </button>
                        <button 
                            className="hero-button secondary"
                            onClick={handleOpenSelectFolderModal}
                        >
                            + Add to List
                        </button>
                    </div>
                </div>
                </div>
            </div>
        </div>

        {/* Cast Section Placeholder */}
        {metadata.cast && metadata.cast.length > 0 && (
            <div className="detail-section cast-section">
                <h2>Cast</h2>
                <div className="cast-list">
                    {metadata.cast.slice(0,10).map((member, index) => ( // Added index for a more robust key
                        <div key={member.name || `cast-member-${index}`} className="cast-member">
                            <div className="cast-member-image-placeholder">
                                {/* Placeholder for image, ideally member.photoUrl */}
                                {member.name && typeof member.name === 'string' ? member.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span className="cast-member-name">{member.name || 'N/A'}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}


        {metadata.type === 'series' && metadata.videos && metadata.videos.length > 0 && (
          <div className="detail-section episodes-section">
            <h2>Episodes</h2>
            <ul className="episode-list">
              {metadata.videos.map(ep => (
                <li key={ep.id || `${ep.season}-${ep.number || ep.episode}`}>
                  <strong>S{ep.season} E{ep.number || ep.episode}: {ep.name || ep.title}</strong>
                  {ep.released && ` (Aired: ${new Date(ep.released).toLocaleDateString()})`}
                  {ep.overview && <span className="episode-overview">{ep.overview}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="detail-section streams-section">
          <h2>Available Streams</h2>
          {isLoadingStreams && <div className="loading-message">Loading streams...</div>}
          {streamError && <div className="error-message stream-error">{streamError}</div>}
          {!isLoadingStreams && streams.length === 0 && !streamError && (
             <p className="stream-placeholder-message">Stream provider (e.g., Torrentio) is not configured or returned no streams. Please add and configure a stream provider addon in settings.</p>
          )}
          {/* Logic for displaying streams would go here */}
        </div>
      </main>
       {isSelectFolderModalOpen && metadata && (
        <SelectFolderModal
          isOpen={isSelectFolderModalOpen}
          onClose={() => setIsSelectFolderModalOpen(false)}
          folders={folders}
          onItemAddMultiple={handleAddItemToSelectedFolders}
          itemTitle={metadata.name || "this item"}
        />
      )}
    </div>
  );
};

export default ItemDetailPage;