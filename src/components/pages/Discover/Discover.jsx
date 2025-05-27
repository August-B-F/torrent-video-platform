// src/components/pages/Discover/Discover.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAddons } from '../../contexts/AddonContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import './DiscoverStyle.css';

const FilterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

const FEED_CONFIG = [
  { id: 'top', name: 'Popular', type: 'genre' },
  { id: 'year', name: 'New Releases', type: 'year' },
  { id: 'imdbRating', name: 'Featured', type: 'genre' }
];

const ITEMS_PER_LOAD_DISCOVER = 20; // Number of items to load per fetch/page for Discover

const interleaveArrays = (arr1, arr2) => {
  const maxLength = Math.max(arr1.length, arr2.length);
  const result = [];
  for (let i = 0; i < maxLength; i++) {
    if (i < arr1.length) result.push(arr1[i]);
    if (i < arr2.length) result.push(arr2[i]);
  }
  return result;
};

const Discover = () => {
  const { cinemeta, isLoadingCinemeta, cinemetaError } = useAddons();

  const [allItems, setAllItems] = useState([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [contentError, setContentError] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const [selectedViewType, setSelectedViewType] = useState('all');
  const [selectedFeed, setSelectedFeed] = useState(FEED_CONFIG[0]);
  const [selectedSubOption, setSelectedSubOption] = useState('');

  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const observer = useRef();
  const filterPanelRef = useRef(null);

  const subOptionsForPanel = useMemo(() => {
    if (!cinemeta || !cinemeta.manifest || !cinemeta.manifest.catalogs || !selectedFeed) return [];
    let relevantTypes = (selectedViewType === 'all') ? ['movie', 'series'] : [selectedViewType];
    const options = new Set();
    relevantTypes.forEach(type => {
      const catalog = cinemeta.manifest.catalogs.find(c => c.type === type && c.id === selectedFeed.id);
      if (catalog && catalog.genres) catalog.genres.forEach(g => options.add(g));
    });
    const sortedOptions = Array.from(options);
    return selectedFeed.type === 'year' ? sortedOptions.sort((a, b) => parseInt(b) - parseInt(a)) : sortedOptions.sort();
  }, [cinemeta, selectedViewType, selectedFeed]);

  const fetchCatalogDataForType = useCallback(async (type, feed, subOptionValue, pageToFetch) => {
    if (!cinemeta) return [];
    const catalogManifest = cinemeta.manifest.catalogs.find(c => c.type === type && c.id === feed.id);
    if (!catalogManifest) {
      console.warn(`No catalog found for type: ${type}, feed ID: ${feed.id}`);
      return [];
    }
    const extra = { skip: pageToFetch * ITEMS_PER_LOAD_DISCOVER };
    if (subOptionValue && catalogManifest.extraSupported && catalogManifest.extraSupported.includes('genre')) {
      extra.genre = subOptionValue;
    }
    if (feed.id === 'year' && !subOptionValue) {
      const genreExtra = catalogManifest.extra?.find(e => e.name === 'genre');
      if (genreExtra?.isRequired) return [];
    }
    try {
      // Note: Cinemeta's 'top' catalog might not respect 'skip' in the same way as 'search'.
      // It often returns a large fixed set. We'll handle this by slicing if needed,
      // but ideally, the API supports pagination for all relevant catalogs.
      // For this example, we assume 'skip' works or we fetch more and paginate client-side (less ideal for large sets).
      const response = await cinemeta.get('catalog', type, feed.id, extra);
      return (response.metas || []).map(item => ({ ...item, type: item.type || type }));
    } catch (err) {
      console.error(`Error fetching data for ${type} ${feed.id} (Page ${pageToFetch}, ${subOptionValue || 'any'}):`, err.message);
      return [];
    }
  }, [cinemeta]);

  const loadContent = useCallback(async (pageToFetch, isNewFilterSelection = false) => {
    if (isLoadingCinemeta || !selectedFeed) return;
    if (selectedFeed.id === 'year' && !selectedSubOption && isNewFilterSelection) {
      setAllItems([]);
      setContentError('Please select a year for "New Releases".');
      setHasMore(false);
      setIsLoadingContent(false);
      setIsLoadingMore(false);
      return;
    }

    if (isNewFilterSelection) {
      setIsLoadingContent(true);
      setAllItems([]); // Clear items for new filter
      setCurrentPage(0); // Reset page for new filter
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }
    setContentError('');

    let movieItems = [];
    let seriesItems = [];

    if (selectedViewType === 'movie' || selectedViewType === 'all') {
      movieItems = await fetchCatalogDataForType('movie', selectedFeed, selectedSubOption, pageToFetch);
    }
    if (selectedViewType === 'series' || selectedViewType === 'all') {
      seriesItems = await fetchCatalogDataForType('series', selectedFeed, selectedSubOption, pageToFetch);
    }

    let fetchedItems = [];
    if (selectedViewType === 'all') {
      fetchedItems = interleaveArrays(movieItems, seriesItems);
    } else if (selectedViewType === 'movie') {
      fetchedItems = movieItems;
    } else {
      fetchedItems = seriesItems;
    }
    
    const uniqueNewItems = Array.from(new Map(fetchedItems.map(item => [item.id, item])).values());

    setAllItems(prevItems => isNewFilterSelection ? uniqueNewItems : [...prevItems, ...uniqueNewItems]);
    
    // Determine if there are more items
    // If fetching both types, we expect up to ITEMS_PER_LOAD_DISCOVER for each.
    // If fetching one type, we expect up to ITEMS_PER_LOAD_DISCOVER.
    const expectedItemsCount = selectedViewType === 'all' ? ITEMS_PER_LOAD_DISCOVER * 2 : ITEMS_PER_LOAD_DISCOVER;
    setHasMore(uniqueNewItems.length >= expectedItemsCount);


    if (isNewFilterSelection && uniqueNewItems.length === 0) {
      setContentError('No content found for the current selection.');
    }
    
    setIsLoadingContent(false);
    setIsLoadingMore(false);
  }, [isLoadingCinemeta, selectedFeed, selectedViewType, selectedSubOption, fetchCatalogDataForType]);
  
  // Initial load and filter changes
  useEffect(() => {
    loadContent(0, true); // true for isNewFilterSelection
  }, [selectedViewType, selectedFeed, selectedSubOption, loadContent]);


  // Infinite scroll observer
  const lastItemElementRef = useCallback(node => {
    if (isLoadingContent || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setCurrentPage(prevPage => {
          const nextPageToFetch = prevPage + 1;
          loadContent(nextPageToFetch, false); // false for isNewFilterSelection
          return nextPageToFetch; 
        });
      }
    }, { rootMargin: "300px 0px" }); // Trigger 300px before element is visible
    if (node) observer.current.observe(node);
  }, [isLoadingContent, isLoadingMore, hasMore, loadContent]);


  useEffect(() => setSelectedSubOption(''), [selectedFeed]);
  const handleResetPanelFilters = () => setSelectedSubOption('');
  const toggleFilterVisibility = () => setIsFilterVisible(prev => !prev);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(event.target)) {
        const toggleButton = document.getElementById('filter-toggle-button');
        if (toggleButton && !toggleButton.contains(event.target)) setIsFilterVisible(false);
      }
    };
    if (isFilterVisible) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterVisible]);

  if (isLoadingCinemeta && !allItems.length) return <div className="page-container discover-page"><div className="loading-message">Initializing...</div></div>;
  if (cinemetaError && !allItems.length) return <div className="page-container discover-page"><div className="error-message global-error">{cinemetaError}</div></div>;
  if (!cinemeta && !isLoadingCinemeta && !allItems.length) return <div className="page-container discover-page"><div className="empty-message">Cinemeta addon not available.</div></div>;

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
                  {FEED_CONFIG.map(feed => (<option key={feed.id} value={feed.id}>{feed.name}</option>))}
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="sub-option-filter">{subOptionLabel}</label>
                <select id="sub-option-filter" value={selectedSubOption} onChange={(e) => setSelectedSubOption(e.target.value)} className="filter-select" disabled={subOptionsForPanel.length === 0 && !(selectedFeed.id === 'year' && !selectedSubOption)}>
                  <option value="">All {subOptionLabel === "Year" ? "Years" : "Genres"}</option>
                  {subOptionsForPanel.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <button onClick={handleResetPanelFilters} className="filter-reset-btn">Clear {subOptionLabel}</button>
            </div>
          )}
        </div>

        {isLoadingContent && !isLoadingMore && <div className="loading-message">Loading {currentFeedDisplay} ({currentViewTypeDisplay})...</div>}
        {contentError && !isLoadingContent && !isLoadingMore && allItems.length === 0 && <div className="error-message discover-content-error">{contentError}</div>}

        {!isLoadingContent && !contentError && allItems.length === 0 && !(selectedFeed.id === 'year' && !selectedSubOption && isFilterVisible) && (
            <div className="empty-message">No items to display for the current selection.</div>
        )}
        
        {allItems.length > 0 && (
          <div className="media-grid discover-grid">
            {allItems.map((item, index) => {
               const key = `${item.id}-${index}`; // Ensure unique key if items can be duplicated before uniqueness filter
               if (allItems.length === index + 1 && hasMore && !isLoadingMore) {
                 return <div ref={lastItemElementRef} key={key}><MediaGridItem item={item} /></div>;
               }
               return <MediaGridItem key={key} item={item} />;
            })}
          </div>
        )}
         {isLoadingMore && <div className="loading-message" style={{padding: "20px", textAlign: "center"}}>Loading more items...</div>}
         {!isLoadingMore && !hasMore && allItems.length > 0 && !isLoadingContent && (
            <div className="empty-message" style={{padding: "20px", textAlign: "center"}}>You've reached the end!</div>
        )}
      </main>
    </div>
  );
};

export default Discover;