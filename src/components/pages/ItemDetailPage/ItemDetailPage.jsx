import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom'; // Link might be used for "Add to Watchlist" if it navigates
import { useAddons } from '../../contexts/AddonContext';
import { useWatchlist } from '../../contexts/WatchlistContext';
import './ItemDetailPage.css';

const ItemDetailPage = () => {
  const { type, id } = useParams();
  const { cinemeta, isLoadingAddons, cinemetaError: globalAddonErr } = useAddons();
  const { addItemToFolder, folders } = useWatchlist();

  const [metadata, setMetadata] = useState(null);
  const [streams, setStreams] = useState([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false); // Set to false initially
  const [metaError, setMetaError] = useState('');
  const [streamError, setStreamError] = useState('');

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
        console.log(`Workspaceing metadata for type: ${type}, id: ${id}`);
        const response = await cinemeta.get('meta', type, id);
        setMetadata(response.meta);
      } catch (e) {
        console.error('Error fetching metadata from Cinemeta:', e);
        setMetaError(`Failed to load metadata: ${e.message}.`);
      } finally {
        setIsLoadingMeta(false);
      }
    };

    fetchMeta();
  }, [cinemeta, type, id, isLoadingAddons]); // `metadata` removed from here

  useEffect(() => {
    // Only proceed if metadata has been successfully fetched and Torrentio (or any stream provider) is available
    // isLoadingAddons should be false, and metadata should exist.
    if (isLoadingAddons || !metadata || !type || !id ) { // Added !metadata check
        // If there's no metadata, there's nothing to fetch streams for.
        // Also, ensure isLoadingStreams is false if we bail early.
        if (metadata === null && !isLoadingMeta) { // If metadata loading finished and it's null
             setStreamError("Cannot fetch streams without item metadata.");
        }
        setIsLoadingStreams(false);
        return;
    }

    // For this example, we are skipping Torrentio and stream fetching as per previous focus.
    // The placeholder message will be shown.
    // If you were to implement Torrentio, the logic would go here.
    setIsLoadingStreams(false);
    // setStreamError("Stream provider (e.g., Torrentio) not configured for this session.");


    /* // Example if Torrentio were to be integrated (conceptual)
    const fetchStreamsForItem = async (itemType, itemIdFromMeta) => {
        // ... (Torrentio fetching logic would go here, using itemIdFromMeta) ...
        // ... (This is where the original errors likely occurred if metadata was used before being set) ...
    };

    if (type === 'movie' && metadata.id) { // Use metadata.id to ensure it's available
        // fetchStreamsForItem(type, metadata.id);
    } else if (type === 'series' && metadata.id && metadata.videos && metadata.videos.length > 0) {
        // ... (logic to select an episode and then fetch streams) ...
        // setIsLoadingStreams(false);
        // setStreamError("Select an episode to see streams (episode selection not implemented in this example).");
    } else {
        setIsLoadingStreams(false);
    }
    */

  }, [isLoadingAddons, metadata, type, id]); // Now depends on metadata being set


  const handleAddToWatchlist = () => {
    if (!metadata || !metadata.id || !metadata.type) {
        alert("Item details not loaded yet or type is missing.");
        return;
    }
    const defaultFolder = folders.find(f => f.id === 'default') || (folders.length > 0 ? folders[0] : null);
    const targetFolderId = defaultFolder ? defaultFolder.id : null; // Add to default or first folder
    
    // addItemToFolder expects (itemId, itemTypeHint, targetFolderId)
    addItemToFolder(metadata.id, metadata.type, targetFolderId);
  };


  if (isLoadingAddons && isLoadingMeta) return <div className="page-container"><div className="loading-message">Initializing addons & loading details...</div></div>;
  if (isLoadingAddons) return <div className="page-container"><div className="loading-message">Initializing addons...</div></div>;
  if (isLoadingMeta) return <div className="page-container"><div className="loading-message">Loading item details...</div></div>;
  
  if (globalAddonErr && !cinemeta) return <div className="page-container"><div className="error-message global-error">{globalAddonErr} Try configuring addons in Settings.</div></div>;
  if (metaError) return <div className="page-container"><div className="error-message">{metaError}</div></div>;
  if (!metadata) return <div className="page-container"><div className="empty-message">Item details could not be loaded (Type: {type}, ID: {id}). Check addon configuration or item ID.</div></div>;

  return (
    <div className="page-container item-detail-page">
      <main className="page-main-content">
        <div className="detail-header">
          <img src={metadata.poster || metadata.background || 'https://via.placeholder.com/300x450?text=No+Poster'} alt={metadata.name} className="detail-poster" />
          <div className="detail-info">
            <h1 className="detail-title">{metadata.name}</h1>
            <div className="detail-meta-row">
              {metadata.year && <span className="meta-year">{metadata.year}</span>}
              {metadata.runtime && <span className="meta-runtime">{metadata.runtime}</span>}
              {metadata.genres && metadata.genres.length > 0 && (
                <span className="meta-genres">{metadata.genres.join(', ')}</span>
              )}
            </div>
            {metadata.imdbRating && <p className="detail-rating">IMDb Rating: ★ {metadata.imdbRating}</p>}
            <p className="detail-description">{metadata.description || 'No description available.'}</p>
            <button 
                className="hero-button primary"
                style={{marginTop: '15px'}}
                onClick={handleAddToWatchlist}
            >
                + Add to List
            </button>
          </div>
        </div>

        {metadata.type === 'series' && metadata.videos && metadata.videos.length > 0 && (
          <div className="episodes-section">
            <h2>Episodes</h2>
            <ul className="episode-list">
              {metadata.videos.map(ep => (
                <li key={ep.id || `${ep.season}-${ep.number || ep.episode}`}> {/* Stremio uses 'number' or 'episode' */}
                  S{ep.season} E{ep.number || ep.episode}: {ep.name || ep.title}
                  {ep.released && ` (Aired: ${new Date(ep.released).toLocaleDateString()})`}
                  {/* Clicking an episode would ideally fetch its streams */}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="streams-section">
          <h2>Available Streams</h2>
          {isLoadingStreams && <div className="loading-message">Loading streams...</div>}
          {streamError && <div className="error-message stream-error">{streamError}</div>}
          {/* Since we are skipping Torrentio, streams array will be empty */}
          {!isLoadingStreams && streams.length === 0 && (
             <p className="empty-message">Stream provider (e.g., Torrentio) is not configured or returned no streams. Please add and configure a stream provider addon in settings.</p>
          )}
          {/* Logic for displaying streams would go here if streams array had data */}
        </div>
      </main>
    </div>
  );
};

export default ItemDetailPage;