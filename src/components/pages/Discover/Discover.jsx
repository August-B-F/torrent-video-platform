import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAddons } from '../../contexts/AddonContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import './DiscoverStyle.css';

const Discover = () => {
  const { cinemeta, isLoadingCinemeta, cinemetaError } = useAddons();
  
  const [allItems, setAllItems] = useState([]); // Items from the currently selected catalog
  const [filteredItems, setFilteredItems] = useState([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState('');

  const [selectedType, setSelectedType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedCatalogKey, setSelectedCatalogKey] = useState(''); 

  const availableCinemetaCatalogs = useMemo(() => {
    if (cinemeta && cinemeta.manifest && cinemeta.manifest.catalogs) {
      return cinemeta.manifest.catalogs
        .filter(cat => (cat.type === 'movie' || cat.type === 'series')) // Only movie/series catalogs
        .map(cat => ({ 
            ...cat, 
            // Create a unique key as catalog IDs might not be unique across types
            uniqueKey: `${cat.type}-${cat.id}${cat.extra && cat.extra.length > 0 ? `-${cat.extra.map(e => e.name).join('-')}` : ''}` 
        }));
    }
    return [];
  }, [cinemeta]);

  const availableGenres = useMemo(() => {
    const genres = new Set();
    allItems.forEach(item => {
      if (item.genres && Array.isArray(item.genres)) {
        item.genres.forEach(g => genres.add(g));
      } else if (item.genre && typeof item.genre === 'string') { // Handle single genre string
        item.genre.split(',').forEach(g => genres.add(g.trim()));
      }
    });
    return Array.from(genres).sort();
  }, [allItems]);

  const availableYears = useMemo(() => {
    const years = new Set();
    allItems.forEach(item => {
      if (item.year) {
        years.add(item.year.toString());
      } else if (item.releaseInfo) {
        // releaseInfo can be a string like "2023" or "2023-03-15" or a number
        const yearStr = String(item.releaseInfo).substring(0, 4);
        if (/^\d{4}$/.test(yearStr)) {
          years.add(yearStr);
        }
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)); // Descending
  }, [allItems]);

  const fetchDiscoverCatalogContent = useCallback(async () => {
    if (!cinemeta || !selectedCatalogKey) {
      setAllItems([]);
      setFilteredItems([]);
      return;
    }
    
    const catalogToFetch = availableCinemetaCatalogs.find(c => c.uniqueKey === selectedCatalogKey);
    if (!catalogToFetch) {
        setContentError("Selected catalog not found.");
        setAllItems([]);
        setFilteredItems([]);
        return;
    }

    setIsLoadingContent(true);
    setContentError('');
    try {
      // Note: Cinemeta catalogs might support 'skip' or 'genre' directly as 'extra' properties.
      // Example: { skip: 0, genre: 'Action' }
      // The 'id' for genre catalogs is often like 'genre/Action'.
      // For 'top', 'popular', 'newest', the 'id' is usually direct.
      const extraProps = {}; // Modify this if your selected catalog requires specific extra properties
      
      // If the catalog ID itself contains genre info (e.g. "genre/Action")
      // some Cinemeta versions use this, others use extra props.
      // The Cinemeta manifest should define this. For example:
      // { "type": "movie", "id": "genre", "name": "Movies by Genre", 
      //   "extra": [{ "name": "genre", "options": ["Action", "..."], "isRequired": true }] }
      // If so, you'd need a way to select the genre for this type of catalog, then pass it in `extraProps`.
      // For simplicity, we are currently selecting pre-defined catalogs.

      const response = await cinemeta.get('catalog', catalogToFetch.type, catalogToFetch.id, extraProps); 
      const uniqueItems = Array.from(new Map((response.metas || []).map(item => [item.id, item])).values());
      
      setAllItems(uniqueItems);
      setFilteredItems(uniqueItems); // Apply filters after setting allItems
      setSelectedType(''); setSelectedGenre(''); setSelectedYear(''); // Reset filters on new catalog load

      if(uniqueItems.length === 0) setContentError("No content found in this catalog.");
    } catch (err) {
      console.error(`Error fetching discover content for catalog ${selectedCatalogKey}:`, err);
      setContentError(`Failed to load content: ${err.message}. This could be a CORS issue or the addon itself.`);
      setAllItems([]);
      setFilteredItems([]);
    } finally {
      setIsLoadingContent(false);
    }
  }, [cinemeta, selectedCatalogKey, availableCinemetaCatalogs]);

  useEffect(() => {
    // Set a default catalog to load initially if not already selected and catalogs are available
    if (!selectedCatalogKey && availableCinemetaCatalogs.length > 0) {
        // Try to find a 'top movies' or 'popular series' catalog as a default
        const defaultMovieCatalog = availableCinemetaCatalogs.find(c => c.id === 'top' && c.type === 'movie');
        const defaultSeriesCatalog = availableCinemetaCatalogs.find(c => c.id === 'popular' && c.type === 'series');
        
        if (defaultMovieCatalog) {
            setSelectedCatalogKey(defaultMovieCatalog.uniqueKey);
        } else if (defaultSeriesCatalog) {
            setSelectedCatalogKey(defaultSeriesCatalog.uniqueKey);
        } else {
            setSelectedCatalogKey(availableCinemetaCatalogs[0].uniqueKey); // Fallback to the first available
        }
    }
  }, [availableCinemetaCatalogs, selectedCatalogKey]);

  useEffect(() => {
    if(selectedCatalogKey){ 
        fetchDiscoverCatalogContent();
    }
  }, [selectedCatalogKey, fetchDiscoverCatalogContent]); // Re-fetch when selectedCatalogKey changes

  // Apply client-side filters
  useEffect(() => {
    let itemsToFilter = [...allItems];
    if (selectedType) {
        itemsToFilter = itemsToFilter.filter(item => item.type === selectedType);
    }
    if (selectedGenre) {
        itemsToFilter = itemsToFilter.filter(item => 
            (item.genres && item.genres.map(g => g.toLowerCase()).includes(selectedGenre.toLowerCase())) ||
            (item.genre && typeof item.genre === 'string' && item.genre.toLowerCase().includes(selectedGenre.toLowerCase()))
        );
    }
    if (selectedYear) {
        itemsToFilter = itemsToFilter.filter(item => 
            (item.year && item.year.toString() === selectedYear) ||
            (item.releaseInfo && String(item.releaseInfo).startsWith(selectedYear))
        );
    }
    setFilteredItems(itemsToFilter);
  }, [selectedType, selectedGenre, selectedYear, allItems]);

  const handleResetFilters = () => {
    setSelectedType(''); 
    setSelectedGenre(''); 
    setSelectedYear('');
    // No need to refetch allItems, just let the filter useEffect run with cleared filters
  };
  
  if (isLoadingCinemeta) {
    return <div className="page-container discover-page"><div className="loading-message">Initializing Cinemeta addon...</div></div>;
  }
  if (cinemetaError) {
    return <div className="page-container discover-page"><div className="error-message global-error">{cinemetaError} Please check Addon Settings.</div></div>;
  }
  if (!cinemeta) {
    return <div className="page-container discover-page"><div className="empty-message">Cinemeta addon not loaded. Configure it in settings to discover content.</div></div>;
  }

  return (
    <div className="page-container discover-page">
      <main className="page-main-content">
        <div className="discover-header">
            <h1 className="page-title">Discover</h1>
        </div>
        
        <div className="filters-panel">
          <select 
            value={selectedCatalogKey} 
            onChange={(e) => setSelectedCatalogKey(e.target.value)} 
            className="filter-select catalog-select"
            title="Select Catalog"
          >
            <option value="">-- Select a Catalog --</option>
            {availableCinemetaCatalogs.map(cat => (
              <option key={cat.uniqueKey} value={cat.uniqueKey}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="filter-select" title="Filter by Type">
            <option value="">All Types</option>
            <option value="movie">Movies</option>
            <option value="series">Series</option>
          </select>
          <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="filter-select" disabled={availableGenres.length === 0} title="Filter by Genre">
            <option value="">All Genres</option>
            {availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="filter-select" disabled={availableYears.length === 0} title="Filter by Year">
            <option value="">All Years</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleResetFilters} className="filter-reset-btn">Reset Filters</button>
        </div>

        {isLoadingContent && <div className="loading-message">Loading items from catalog...</div>}
        {contentError && !isLoadingContent && <div className="error-message discover-content-error">{contentError}</div>}
        
        {!isLoadingContent && !contentError && filteredItems.length > 0 && (
          <div className="media-grid discover-grid">
            {filteredItems.map(item => (
              <MediaGridItem key={item.id} item={item} />
            ))}
          </div>
        )}
        {/* Message if catalog loaded but no items */}
        {!isLoadingContent && !contentError && filteredItems.length === 0 && allItems.length === 0 && selectedCatalogKey && (
             <div className="empty-message">The selected catalog "{availableCinemetaCatalogs.find(c=>c.uniqueKey === selectedCatalogKey)?.name}" is currently empty or failed to load.</div>
        )}
        {/* Message if filters result in no items, but the catalog had items */}
        {!isLoadingContent && !contentError && filteredItems.length === 0 && allItems.length > 0 && (
          <div className="empty-message">No items match your current filters in this catalog.</div>
        )}
      </main>
    </div>
  );
};

export default Discover;