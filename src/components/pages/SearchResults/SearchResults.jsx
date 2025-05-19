import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import './SearchResultsStyle.css';

const ITEMS_PER_PAGE = 20; // Or whatever Cinemeta's search catalog typically pages by

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const { cinemeta, isLoadingCinemeta, cinemetaError: globalAddonErr } = useAddons();

  // State for all fetched results (accumulated for infinite scroll)
  const [allResults, setAllResults] = useState([]);
  // State for results after client-side filtering
  const [filteredResults, setFilteredResults] = useState([]);

  const [isLoading, setIsLoading] = useState(false); // For initial search
  const [isLoadingMore, setIsLoadingMore] = useState(false); // For loading subsequent pages
  const [searchError, setSearchError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  // Filter states
  const [selectedType, setSelectedType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  const observer = useRef(); // For IntersectionObserver

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
      setHasMore(true); // Assume more until fetch proves otherwise
      // Reset client-side filters for a new query
      setSelectedType('');
      setSelectedGenre('');
      setSelectedYear('');
    } else {
      setIsLoadingMore(true);
    }
    setSearchError('');

    // console.log(`SearchResults: Performing search for: "${query}", Page: ${pageToFetch}`);

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
      // Ensure items have an ID before deduplication
      const uniqueNewItems = Array.from(new Map(newFetchedItems.filter(item => item && item.id).map(item => [item.id, item])).values());

      setAllResults(prevResults => {
          const combined = isNewQuery ? uniqueNewItems : [...prevResults, ...uniqueNewItems];
          // Deduplicate again after combining, in case of overlaps or items already present
          return Array.from(new Map(combined.map(item => [item.id, item])).values());
      });
      
      setHasMore(uniqueNewItems.length >= ITEMS_PER_PAGE); // Heuristic for more pages
      
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cinemeta]); // Dependencies that trigger a full new search or affect fetching logic

  useEffect(() => {
    window.scrollTo(0, 0);
    if (isLoadingCinemeta) {
      setSearchError("Initializing addon service..."); return;
    }
    if (globalAddonErr) {
      setSearchError(`Cinemeta Addon Error: ${globalAddonErr}`); return;
    }
    if (!cinemeta && !isLoadingCinemeta) { // Ensure cinemeta is checked after loading state
      setSearchError("Cinemeta addon not available. Please configure it in settings."); return;
    }
    if (!query) {
      setAllResults([]); setFilteredResults([]);
      setSearchError('Please enter a search term.'); return;
    }
    // Trigger initial search when query or cinemeta changes (after loading)
    performSearch(0, true);
  }, [query, cinemeta, isLoadingCinemeta, globalAddonErr, performSearch]);


  // Client-side filtering based on allResults
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
    allResults.forEach(item => { // Use allResults for complete genre list
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
    allResults.forEach(item => { // Use allResults for complete year list
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

  // Intersection Observer for infinite scroll
  const lastItemElementRef = useCallback(node => {
    if (isLoadingMore || isLoading) return; // Don't observe if already loading initial or more
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        // console.log("SearchResults: Last item visible, loading more...");
        setCurrentPage(prevPage => {
          const nextPageToFetch = prevPage + 1;
          performSearch(nextPageToFetch, false); // false for isNewQuery
          return nextPageToFetch; 
        });
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoadingMore, isLoading, hasMore, performSearch]);


  // Initial loading messages
  if (isLoadingCinemeta && !query) {
    return <div className="page-container search-results-page"><div className="loading-message">Initializing addon service...</div></div>;
  }
  if (!query && !isLoadingCinemeta && !globalAddonErr && !cinemeta) { // Waiting for addon but no query yet
     return <div className="page-container search-results-page"><div className="empty-message">Enter a search term above.</div></div>;
  }


  return (
    <div className="page-container search-results-page">
      <main className="page-main-content">
        {query ? (
          <h1 className="page-title">
            Search results for: <span className="search-query-highlight">{query}</span>
          </h1>
        ) : (
          <h1 className="page-title">Enter a search term above.</h1>
        )}
        
        {/* Show filters if there are initial results or loading initial results for a query */}
        {(allResults.length > 0 || isLoading) && query && !searchError && (
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
               if (filteredResults.length === index + 1) { // If it's the last item for the observer
                 return <div ref={lastItemElementRef} key={key}><MediaGridItem item={item} /></div>;
               } else {
                 return <MediaGridItem key={key} item={item} />;
               }
            })}
          </div>
        )}
        {/* Message if filters result in no items, but initial search had results */}
        {!isLoading && !searchError && query && filteredResults.length === 0 && allResults.length > 0 && (
          <div className="empty-message" style={{textAlign:'center', padding: '20px'}}>
            No items match your current filters for "{query}".
          </div>
        )}
        {/* Message if search returned no results at all for the query (and wasn't just an error before searching) */}
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