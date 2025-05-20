import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAddons } from '../../contexts/AddonContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import './DiscoverStyle.css';

// Filter Icon SVG
const FilterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

// Configuration for available feeds based on your manifest
const FEED_CONFIG = [
  { id: 'top', name: 'Popular', type: 'genre' }, // 'top' in manifest uses genres
  { id: 'year', name: 'New Releases', type: 'year' }, // 'year' in manifest uses years as genres
  { id: 'imdbRating', name: 'Featured', type: 'genre' } // 'imdbRating' in manifest uses genres
];

const Discover = () => {
  const { cinemeta, isLoadingCinemeta, cinemetaError } = useAddons();

  const [allItems, setAllItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]); // Not strictly needed if API does all filtering
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // Primary type selection by user
  const [selectedViewType, setSelectedViewType] = useState('all'); // 'all', 'movie', 'series'

  // Filters within the panel
  const [selectedFeed, setSelectedFeed] = useState(FEED_CONFIG[0]); // Default to 'Popular'
  const [selectedSubOption, setSelectedSubOption] = useState(''); // For genre or year

  const filterPanelRef = useRef(null);

  // Dynamically populate Genre/Year options for the panel based on manifest and selected view type/feed
  const subOptionsForPanel = useMemo(() => {
    if (!cinemeta || !cinemeta.manifest || !cinemeta.manifest.catalogs || !selectedFeed) return [];

    let relevantTypes = [];
    if (selectedViewType === 'all') {
      relevantTypes = ['movie', 'series'];
    } else {
      relevantTypes = [selectedViewType];
    }

    const options = new Set();
    relevantTypes.forEach(type => {
      const catalog = cinemeta.manifest.catalogs.find(
        c => c.type === type && c.id === selectedFeed.id
      );
      if (catalog && catalog.genres) { // 'genres' array in manifest contains years for 'year' catalog
        catalog.genres.forEach(g => options.add(g));
      }
    });
    
    const sortedOptions = Array.from(options);
    if (selectedFeed.type === 'year') {
      return sortedOptions.sort((a, b) => parseInt(b) - parseInt(a)); // Sort years descending
    }
    return sortedOptions.sort(); // Sort genres alphabetically
  }, [cinemeta, selectedViewType, selectedFeed]);


  const fetchCatalogDataForType = useCallback(async (type, feed, subOptionValue) => {
    if (!cinemeta) return [];
    const catalogManifest = cinemeta.manifest.catalogs.find(c => c.type === type && c.id === feed.id);
    if (!catalogManifest) {
      console.warn(`No catalog found for type: ${type}, feed ID: ${feed.id}`);
      return [];
    }

    const extra = {};
    // If a subOption (genre or year) is selected AND the catalog supports 'genre' in extra
    if (subOptionValue && catalogManifest.extraSupported && catalogManifest.extraSupported.includes('genre')) {
      extra.genre = subOptionValue;
    }
    
    // Handle required 'genre' (which is year for 'year' feed)
    if (feed.id === 'year' && !subOptionValue) {
        // If 'New Releases' feed is selected but no year, don't fetch, or fetch all years (if API allows)
        // For now, we'll require a year if the catalog says genre (year) is required.
        const genreExtra = catalogManifest.extra?.find(e => e.name === 'genre');
        if (genreExtra?.isRequired) {
            console.log(`Year selection required for ${type}/${feed.id}`);
            return []; // Or set a specific error/message
        }
    }

    try {
      const response = await cinemeta.get('catalog', type, feed.id, extra);
      return (response.metas || []).map(item => ({ ...item, type: item.type || type })); // Ensure type is set
    } catch (err) {
      console.error(`Error fetching data for ${type} ${feed.id} (${subOptionValue || 'any'}):`, err.message);
      return [];
    }
  }, [cinemeta]);


  useEffect(() => {
    const loadContent = async () => {
      if (isLoadingCinemeta || !selectedFeed) return;

      // If "New Releases" (year-based) is selected and no year is chosen, clear items and optionally show a message.
      if (selectedFeed.id === 'year' && !selectedSubOption) {
        setAllItems([]);
        setFilteredItems([]);
        setContentError('Please select a year for "New Releases".');
        setIsLoadingContent(false);
        return;
      }

      setIsLoadingContent(true);
      setContentError('');

      let movieItems = [];
      let seriesItems = [];

      if (selectedViewType === 'movie' || selectedViewType === 'all') {
        movieItems = await fetchCatalogDataForType('movie', selectedFeed, selectedSubOption);
      }
      if (selectedViewType === 'series' || selectedViewType === 'all') {
        seriesItems = await fetchCatalogDataForType('series', selectedFeed, selectedSubOption);
      }

      const combined = [...movieItems, ...seriesItems];
      const uniqueItems = Array.from(new Map(combined.map(item => [item.id, item])).values());
      
      setAllItems(uniqueItems);
      setFilteredItems(uniqueItems); // Initially, all fetched items are filtered items
      setIsLoadingContent(false);

      if (uniqueItems.length === 0) {
        setContentError('No content found for the current selection.');
      }
    };
    loadContent();
  }, [selectedViewType, selectedFeed, selectedSubOption, isLoadingCinemeta, fetchCatalogDataForType]);
  
  // Reset sub-option when feed changes
  useEffect(() => {
    setSelectedSubOption('');
  }, [selectedFeed]);


  const handleResetPanelFilters = () => {
    setSelectedSubOption(''); // This will trigger a re-fetch by the main useEffect
  };

  const toggleFilterVisibility = () => setIsFilterVisible(prev => !prev);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(event.target)) {
        const toggleButton = document.getElementById('filter-toggle-button');
        if (toggleButton && !toggleButton.contains(event.target)) {
          setIsFilterVisible(false);
        }
      }
    };
    if (isFilterVisible) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterVisible]);


  if (isLoadingCinemeta) return <div className="page-container discover-page"><div className="loading-message">Initializing...</div></div>;
  if (cinemetaError) return <div className="page-container discover-page"><div className="error-message global-error">{cinemetaError}</div></div>;
  if (!cinemeta) return <div className="page-container discover-page"><div className="empty-message">Cinemeta addon not available.</div></div>;

  const currentFeedDisplay = selectedFeed ? selectedFeed.name : "Feed";
  const currentViewTypeDisplay = selectedViewType.charAt(0).toUpperCase() + selectedViewType.slice(1);
  const subOptionLabel = selectedFeed.type === 'year' ? "Year" : "Genre";

  return (
    <div className="page-container discover-page">
      <main className="page-main-content">
        <div className="discover-header">
          <h1 className="page-title">Discover</h1>
          <div className="discover-controls">
            <select value={selectedViewType} onChange={(e) => setSelectedViewType(e.target.value)} className="filter-select main-type-select">
              <option value="all">All Types</option>
              <option value="movie">Movies</option>
              <option value="series">Series</option>
            </select>
            <button onClick={toggleFilterVisibility} className={`filter-toggle-btn icon-button ${isFilterVisible ? 'active' : ''}`} id="filter-toggle-button">
              <FilterIcon />
              <span>Filters</span>
            </button>
          </div>
        </div>

        <div className={`filters-panel-container ${isFilterVisible ? 'open' : ''}`} ref={filterPanelRef}>
          {isFilterVisible && (
            <div className="filters-panel active">
              <div className="filter-group">
                <label htmlFor="feed-filter">Feed Type</label>
                <select 
                    id="feed-filter" 
                    value={selectedFeed.id} 
                    onChange={(e) => {
                        const newFeed = FEED_CONFIG.find(f => f.id === e.target.value);
                        if (newFeed) setSelectedFeed(newFeed);
                    }} 
                    className="filter-select"
                >
                  {FEED_CONFIG.map(feed => (
                    <option key={feed.id} value={feed.id}>{feed.name}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="sub-option-filter">{subOptionLabel}</label>
                <select
                  id="sub-option-filter"
                  value={selectedSubOption}
                  onChange={(e) => setSelectedSubOption(e.target.value)}
                  className="filter-select"
                  disabled={subOptionsForPanel.length === 0 && !(selectedFeed.id === 'year' && !selectedSubOption)}
                >
                  <option value="">All {subOptionLabel === "Year" ? "Years" : "Genres"}</option>
                  {subOptionsForPanel.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <button onClick={handleResetPanelFilters} className="filter-reset-btn">Clear {subOptionLabel}</button>
            </div>
          )}
        </div>

        {isLoadingContent && <div className="loading-message">Loading {currentFeedDisplay} ({currentViewTypeDisplay})...</div>}
        {contentError && !isLoadingContent && <div className="error-message discover-content-error">{contentError}</div>}

        {!isLoadingContent && !contentError && filteredItems.length > 0 && (
          <div className="media-grid discover-grid">
            {filteredItems.map(item => (<MediaGridItem key={item.id} item={item} />))}
          </div>
        )}
        {!isLoadingContent && !contentError && filteredItems.length === 0 && (
            (selectedFeed.id === 'year' && !selectedSubOption && isFilterVisible) ? 
            <div className="empty-message">Please select a year for the "{selectedFeed.name}" feed in the filters.</div>
            :
            <div className="empty-message">No items to display for the current selection.</div>
        )}
      </main>
    </div>
  );
};

export default Discover;