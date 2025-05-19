import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAddons } from '../../contexts/AddonContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import './DiscoverStyle.css';

const ITEMS_PER_PAGE = 40; // Standard page size for many Stremio addons

const Discover = () => {
  const { cinemeta, isLoadingCinemeta, cinemetaError } = useAddons();
  
  const [allItems, setAllItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [contentError, setContentError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  
  const [selectedType, setSelectedType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedCatalogKey, setSelectedCatalogKey] = useState('');

  const observer = useRef();

  const availableCinemetaCatalogs = useMemo(() => {
    if (cinemeta && cinemeta.manifest && Array.isArray(cinemeta.manifest.catalogs)) {
      return cinemeta.manifest.catalogs
        .filter(cat => (cat.type === 'movie' || cat.type === 'series') && cat.id && cat.name)
        .map(cat => ({ 
            ...cat, 
            uniqueKey: `${cat.type}-${cat.id}${cat.extra && Array.isArray(cat.extra) && cat.extra.length > 0 ? `-${cat.extra.map(e => e.name).join('-')}` : ''}` 
        }));
    }
    return [];
  }, [cinemeta]);

  const availableGenres = useMemo(() => {
    const genres = new Set();
    allItems.forEach(item => {
      if (item.genres && Array.isArray(item.genres)) {
        item.genres.forEach(g => { if(g) genres.add(g); });
      } else if (item.genre && typeof item.genre === 'string' && item.genre.trim()) {
        item.genre.split(',').forEach(g => { if(g && g.trim()) genres.add(g.trim()); });
      }
    });
    return Array.from(genres).sort();
  }, [allItems]);

  const availableYears = useMemo(() => {
    const years = new Set();
    allItems.forEach(item => {
      let yearStr = null;
      if (item.year) {
        yearStr = String(item.year);
      } else if (item.releaseInfo) {
        yearStr = String(item.releaseInfo).substring(0, 4);
      }
      if (yearStr && /^\d{4}$/.test(yearStr)) {
        years.add(yearStr);
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [allItems]);

  const fetchDiscoverCatalogContent = useCallback(async (pageToFetch = 0, isNewCatalogSelection = false) => {
    if (!cinemeta || !selectedCatalogKey) {
      if (isNewCatalogSelection) {
          setAllItems([]);
          setFilteredItems([]);
      }
      setHasMore(false);
      return;
    }
    
    const catalogToFetch = availableCinemetaCatalogs.find(c => c.uniqueKey === selectedCatalogKey);
    if (!catalogToFetch) {
        setContentError("Selected catalog definition not found.");
        if (isNewCatalogSelection) {
            setAllItems([]);
            setFilteredItems([]);
        }
        setHasMore(false);
        return;
    }

    if (isNewCatalogSelection) {
        setIsLoadingContent(true);
        setAllItems([]); 
        setFilteredItems([]);
        setCurrentPage(0);    
        setHasMore(true);    
        setSelectedType('');
        setSelectedGenre('');
        setSelectedYear('');
    } else {
        setIsLoadingMore(true);
    }
    setContentError('');

    try {
      const skip = pageToFetch * ITEMS_PER_PAGE;
      const extraProps = { skip: skip }; 
      // console.log(`Discover: Fetching catalog: ${catalogToFetch.name}, Type: ${catalogToFetch.type}, ID: ${catalogToFetch.id}, Page: ${pageToFetch}, Skip: ${skip}`);

      const response = await cinemeta.get('catalog', catalogToFetch.type, catalogToFetch.id, extraProps); 
      const newMetasRaw = response.metas || [];
      const newMetas = newMetasRaw.filter(item => item && item.id); // Ensure items have an ID

      // console.log("Discover: Fetched items count:", newMetas.length);

      setAllItems(prevItems => {
        const combined = isNewCatalogSelection ? newMetas : [...prevItems, ...newMetas];
        // Deduplicate after combining
        return Array.from(new Map(combined.map(item => [item.id, item])).values());
      });
      setHasMore(newMetas.length >= ITEMS_PER_PAGE); 
      
      if(isNewCatalogSelection && newMetas.length === 0) {
        setContentError(`No content found in the "${catalogToFetch.name}" catalog.`);
      }
    } catch (err) {
      console.error(`Discover: Error fetching content for catalog ${selectedCatalogKey} (Page ${pageToFetch}):`, err);
      setContentError(`Failed to load content: ${err.message}. Check addon or network.`);
      setHasMore(false);
    } finally {
      setIsLoadingContent(false);
      setIsLoadingMore(false);
    }
  }, [cinemeta, selectedCatalogKey, availableCinemetaCatalogs]);

  useEffect(() => {
    if (availableCinemetaCatalogs.length > 0 && !selectedCatalogKey) {
        const defaultMovieCatalog = availableCinemetaCatalogs.find(c => c.id === 'top' && c.type === 'movie');
        const defaultSeriesCatalog = availableCinemetaCatalogs.find(c => c.id === 'popular' && c.type === 'series');
        
        let initialCatalogKey = availableCinemetaCatalogs[0].uniqueKey;
        if (defaultMovieCatalog) initialCatalogKey = defaultMovieCatalog.uniqueKey;
        else if (defaultSeriesCatalog) initialCatalogKey = defaultSeriesCatalog.uniqueKey;
        
        setSelectedCatalogKey(initialCatalogKey);
    }
  }, [availableCinemetaCatalogs, selectedCatalogKey]);

  useEffect(() => {
    if(selectedCatalogKey && cinemeta){
        fetchDiscoverCatalogContent(0, true); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCatalogKey, cinemeta]); // fetchDiscoverCatalogContent removed

  useEffect(() => {
    let itemsToFilter = [...allItems];
    if (selectedType) itemsToFilter = itemsToFilter.filter(item => item.type === selectedType);
    if (selectedGenre) {
        itemsToFilter = itemsToFilter.filter(item => 
            (item.genres && item.genres.map(g => String(g).toLowerCase()).includes(selectedGenre.toLowerCase())) ||
            (item.genre && typeof item.genre === 'string' && item.genre.toLowerCase().includes(selectedGenre.toLowerCase()))
        );
    }
    if (selectedYear) {
        itemsToFilter = itemsToFilter.filter(item => 
            (item.year && String(item.year) === selectedYear) ||
            (item.releaseInfo && String(item.releaseInfo).startsWith(selectedYear))
        );
    }
    setFilteredItems(itemsToFilter);
  }, [selectedType, selectedGenre, selectedYear, allItems]);

  const handleResetFilters = () => {
    setSelectedType(''); 
    setSelectedGenre(''); 
    setSelectedYear('');
  };
  
  const lastItemElementRef = useCallback(node => {
    if (isLoadingMore || isLoadingContent) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setCurrentPage(prevPage => {
          const nextPageToFetch = prevPage + 1;
          fetchDiscoverCatalogContent(nextPageToFetch, false);
          return nextPageToFetch; 
        });
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoadingMore, isLoadingContent, hasMore, fetchDiscoverCatalogContent]);
  
  if (isLoadingCinemeta) {
    return <div className="page-container discover-page"><div className="loading-message">Initializing Cinemeta addon...</div></div>;
  }
  if (cinemetaError) {
    return <div className="page-container discover-page"><div className="error-message global-error" style={{textAlign: 'center', padding: '20px'}}>{cinemetaError} Please check Addon Settings.</div></div>;
  }
  if (!cinemeta) {
    return <div className="page-container discover-page"><div className="empty-message" style={{textAlign: 'center', padding: '20px'}}>Cinemeta addon not loaded. Configure it in settings to discover content.</div></div>;
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
            disabled={isLoadingContent || isLoadingMore}
          >
            <option value="">-- Select a Catalog --</option>
            {availableCinemetaCatalogs.map(cat => (
              <option key={cat.uniqueKey} value={cat.uniqueKey}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="filter-select" title="Filter by Type" disabled={isLoadingContent || isLoadingMore || allItems.length === 0}>
            <option value="">All Types</option><option value="movie">Movies</option><option value="series">Series</option>
          </select>
          <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="filter-select" disabled={isLoadingContent || isLoadingMore || availableGenres.length === 0} title="Filter by Genre">
            <option value="">All Genres</option>{availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="filter-select" disabled={isLoadingContent || isLoadingMore || availableYears.length === 0} title="Filter by Year">
            <option value="">All Years</option>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleResetFilters} className="filter-reset-btn" disabled={isLoadingContent || isLoadingMore}>Reset Filters</button>
        </div>

        {isLoadingContent && <div className="loading-message">Loading content...</div>}
        {contentError && !isLoadingContent && <div className="error-message discover-content-error" style={{textAlign: 'center', padding: '20px'}}>{contentError}</div>}
        
        {!isLoadingContent && !contentError && filteredItems.length === 0 && allItems.length > 0 && (
          <div className="empty-message" style={{textAlign: 'center', padding: '20px'}}>No items match your current filters in this catalog.</div>
        )}
        {!isLoadingContent && !contentError && filteredItems.length === 0 && selectedCatalogKey && allItems.length === 0 && !isLoadingCinemeta && (
             <div className="empty-message" style={{textAlign: 'center', padding: '20px'}}>
                The selected catalog "{availableCinemetaCatalogs.find(c=>c.uniqueKey === selectedCatalogKey)?.name}" is currently empty or could not be loaded.
             </div>
        )}
    
        {filteredItems.length > 0 && (
          <div className="media-grid discover-grid">
            {filteredItems.map((item, index) => {
              const key = item.id ? item.id : `discover-item-${index}`; // Ensure key is always present
              if (filteredItems.length === index + 1) { 
                return <div ref={lastItemElementRef} key={key}><MediaGridItem item={item} /></div>;
              } else {
                return <MediaGridItem key={key} item={item} />;
              }
            })}
          </div>
        )}
        {isLoadingMore && <div className="loading-message" style={{padding: "20px", textAlign: "center"}}>Loading more items...</div>}
        {!isLoadingMore && !hasMore && filteredItems.length > 0 && !isLoadingContent && (
            <div className="empty-message" style={{padding: "20px", textAlign: "center"}}>You've reached the end!</div>
        )}
      </main>
    </div>
  );
};

export default Discover;