// src/components/pages/SearchResults/SearchResults.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import './SearchResultsStyle.css';

const ITEMS_PER_PAGE = 20; // Or whatever Cinemeta's search catalog typically pages by

// Simple Filter Icon SVG (can be moved to a shared icons file)
const FilterIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
);


const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const { cinemeta, isLoadingCinemeta, cinemetaError: globalAddonErr } = useAddons();

  const [allResults, setAllResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  const [selectedType, setSelectedType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showFilters, setShowFilters] = useState(false); // State for filter panel visibility

  const observer = useRef();

  const performSearch = useCallback(async (pageToFetch = 0, isNewQuery = false) => {
    if (!query || !cinemeta) {
      if(isNewQuery) { setAllResults([]); setFilteredResults([]); }
      setHasMore(false);
      return;
    }

    if (isNewQuery) {
      setIsLoading(true);
      setAllResults([]);
      setFilteredResults([]);
      setCurrentPage(0);
      setHasMore(true);
      setSelectedType('');
      setSelectedGenre('');
      setSelectedYear('');
      // setShowFilters(false); // Optionally hide filters on new search
    } else {
      setIsLoadingMore(true);
    }
    setSearchError('');

    try {
      let movieResults = [], seriesResults = [];
      const searchExtra = { search: query, skip: pageToFetch * ITEMS_PER_PAGE };

      const movieSearchRequest = { resource: 'catalog', type: 'movie', id: 'search', extra: searchExtra };
      try {
        const movieResponse = await cinemeta.get(movieSearchRequest.resource, movieSearchRequest.type, movieSearchRequest.id, movieSearchRequest.extra);
        movieResults = (movieResponse.metas || []).map(m => ({ ...m, type: 'movie' }));
      } catch (e) { /* console.warn(`Movie search failed for page ${pageToFetch}:`, e.message); */ }

      const seriesSearchRequest = { resource: 'catalog', type: 'series', id: 'search', extra: searchExtra };
      try {
        const seriesResponse = await cinemeta.get(seriesSearchRequest.resource, seriesSearchRequest.type, seriesSearchRequest.id, seriesSearchRequest.extra);
        seriesResults = (seriesResponse.metas || []).map(s => ({ ...s, type: 'series' }));
      } catch (e) { /* console.warn(`Series search failed for page ${pageToFetch}:`, e.message); */ }
      
      const newFetchedItems = [...movieResults, ...seriesResults];
      const uniqueNewItems = Array.from(new Map(newFetchedItems.filter(item => item && item.id).map(item => [item.id, item])).values());

      setAllResults(prevResults => {
          const combined = isNewQuery ? uniqueNewItems : [...prevResults, ...uniqueNewItems];
          return Array.from(new Map(combined.map(item => [item.id, item])).values());
      });
      
      setHasMore(uniqueNewItems.length >= ITEMS_PER_PAGE); 
      
      if (isNewQuery && uniqueNewItems.length === 0) {
         setSearchError(`No results found for "${query}".`);
      }
    } catch (e) {
      console.error('SearchResults: General error during search execution:', e);
      setSearchError(`Search failed: ${e.message}.`);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [query, cinemeta]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (isLoadingCinemeta) {
      setSearchError("Initializing addon service..."); return;
    }
    if (globalAddonErr) {
      setSearchError(`Cinemeta Addon Error: ${globalAddonErr}`); return;
    }
    if (!cinemeta && !isLoadingCinemeta) {
      setSearchError("Cinemeta addon not available. Please configure it in settings."); return;
    }
    if (!query) {
      setAllResults([]); setFilteredResults([]);
      setSearchError('Please enter a search term.'); return;
    }
    performSearch(0, true);
  }, [query, cinemeta, isLoadingCinemeta, globalAddonErr, performSearch]);

  useEffect(() => {
    let itemsToFilter = [...allResults];
    if (selectedType) {
      itemsToFilter = itemsToFilter.filter(item => item.type === selectedType);
    }
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
    setFilteredResults(itemsToFilter);
  }, [selectedType, selectedGenre, selectedYear, allResults]);

  const availableGenres = useMemo(() => {
    const genres = new Set();
    allResults.forEach(item => {
      if (item.genres && Array.isArray(item.genres)) { 
        item.genres.forEach(g => { if (g) genres.add(g); }); 
      } else if (typeof item.genre === 'string' && item.genre.trim()) { 
        item.genre.split(',').forEach(g => { if (g && g.trim()) genres.add(g.trim()); });
      }
    });
    return Array.from(genres).sort();
  }, [allResults]);

  const availableYears = useMemo(() => {
    const years = new Set();
    allResults.forEach(item => {
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
  }, [allResults]);

  const handleResetFilters = () => {
    setSelectedType('');
    setSelectedGenre('');
    setSelectedYear('');
  };

  const lastItemElementRef = useCallback(node => {
    if (isLoadingMore || isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setCurrentPage(prevPage => {
          const nextPageToFetch = prevPage + 1;
          performSearch(nextPageToFetch, false);
          return nextPageToFetch; 
        });
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoadingMore, isLoading, hasMore, performSearch]);

  if (isLoadingCinemeta && !query) {
    return <div className="page-container search-results-page"><div className="loading-message">Initializing addon service...</div></div>;
  }
  if (!query && !isLoadingCinemeta && !globalAddonErr && !cinemeta) {
     return <div className="page-container search-results-page"><div className="empty-message">Enter a search term above.</div></div>;
  }

  return (
    <div className="page-container search-results-page">
      <main className="page-main-content">
        <div className="search-results-header"> {/* New wrapper for title and filter button */}
          {query ? (
            <h1 className="page-title">
              Search results for: <span className="search-query-highlight">{query}</span>
            </h1>
          ) : (
            <h1 className="page-title">Enter a search term above.</h1>
          )}
          {/* Only show filter button if there are results to filter or initial loading isn't showing an error state */}
          {(allResults.length > 0 || (isLoading && query && !searchError)) && !globalAddonErr && cinemeta && (
            <button 
              onClick={() => setShowFilters(prev => !prev)} 
              className="toggle-filters-btn"
              aria-expanded={showFilters}
            >
              <FilterIcon />
              Filters
            </button>
          )}
        </div>
        
        {showFilters && (allResults.length > 0 || isLoading) && query && !globalAddonErr && cinemeta && (
          <div className="filters-panel">
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="filter-select" disabled={isLoading || isLoadingMore}>
              <option value="">All Types</option><option value="movie">Movies</option><option value="series">Series</option>
            </select>
            <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="filter-select" disabled={isLoading || isLoadingMore || availableGenres.length === 0}>
              <option value="">All Genres</option>{availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="filter-select" disabled={isLoading || isLoadingMore || availableYears.length === 0}>
              <option value="">All Years</option>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleResetFilters} className="filter-reset-btn" disabled={isLoading || isLoadingMore}>Reset Filters</button>
          </div>
        )}

        {isLoading && <div className="loading-message">Searching...</div>}
        {searchError && !isLoading && <div className="empty-message" style={{textAlign:'center', padding: '20px'}}>{searchError}</div>}
        
        {!isLoading && !searchError && filteredResults.length > 0 && (
          <div className="media-grid search-results-grid">
            {filteredResults.map((item, index) => {
               const key = item.id || `search-result-${index}`;
               if (filteredResults.length === index + 1) {
                 return <div ref={lastItemElementRef} key={key}><MediaGridItem item={item} /></div>;
               } else {
                 return <MediaGridItem key={key} item={item} />;
               }
            })}
          </div>
        )}
        {!isLoading && !searchError && query && filteredResults.length === 0 && allResults.length > 0 && (
          <div className="empty-message" style={{textAlign:'center', padding: '20px'}}>
            No items match your current filters for "{query}".
          </div>
        )}
         {!isLoading && !searchError && query && filteredResults.length === 0 && allResults.length === 0 && (
          <div className="empty-message" style={{textAlign:'center', padding: '20px'}}>
            {searchError || `No results found for "${query}".`}
          </div>
        )}

        {isLoadingMore && <div className="loading-message" style={{padding: "20px", textAlign: "center"}}>Loading more items...</div>}
        {!isLoadingMore && !hasMore && filteredResults.length > 0 && !isLoading && (
            <div className="empty-message" style={{padding: "20px", textAlign: "center"}}>You've reached the end of the search results!</div>
        )}
      </main>
    </div>
  );
};

export default SearchResults;