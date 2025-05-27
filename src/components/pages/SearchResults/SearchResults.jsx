// src/components/pages/SearchResults/SearchResults.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import './SearchResultsStyle.css';

const ITEMS_PER_PAGE = 20; // This is for EACH type (movie/series) when fetching both

const FilterIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
);

const interleaveArrays = (arr1, arr2) => {
  const maxLength = Math.max(arr1.length, arr2.length);
  const result = [];
  for (let i = 0; i < maxLength; i++) {
    if (i < arr1.length) result.push(arr1[i]);
    if (i < arr2.length) result.push(arr2[i]);
  }
  return result;
};

const scoreAndSortSearchResults = (results, query, selectedTypeFilter = '') => {
  if (!Array.isArray(results) || !query) return results;
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
  const queryYearMatch = queryLower.match(/\b(19\d{2}|20\d{2})\b/);
  const queryYear = queryYearMatch ? queryYearMatch[0] : null;

  const levenshteinDistance = (s1, s2) => {
    if (!s1) return s2 ? s2.length : 0;
    if (!s2) return s1.length;
    const arr = [];
    for (let i = 0; i <= s2.length; i++) {
      arr[i] = [i];
      for (let j = 1; j <= s1.length; j++) {
        arr[i][j] =
          i === 0
            ? j
            : Math.min(
                arr[i - 1][j] + 1,
                arr[i][j - 1] + 1,
                arr[i - 1][j - 1] + (s1[j - 1] === s2[i - 1] ? 0 : 1)
              );
      }
    }
    return arr[s2.length][s1.length];
  };

  return results
    .map(item => {
      let score = 0;
      const title = item.name || item.title || '';
      const titleLower = title.toLowerCase();
      const descriptionLower = item.description ? item.description.toLowerCase() : '';

      if (titleLower === queryLower) score += 200;
      else {
        const distance = levenshteinDistance(queryLower, titleLower);
        if (distance <= 2) score += (150 - distance * 40);
      }
      if (score < 100 && titleLower.includes(queryLower)) score += 70;
      let wordMatchBonus = 0;
      queryWords.forEach(word => { if (titleLower.includes(word)) wordMatchBonus += 15; });
      if (wordMatchBonus > 0) score += wordMatchBonus;
      if (titleLower.startsWith(queryWords[0])) score += 25;
      const imdbRatingValue = item.imdbRating || item.imdb_rating;
      const imdbRating = parseFloat(imdbRatingValue);
      if (!isNaN(imdbRating) && imdbRating > 0) score += imdbRating * 6;
      if (queryYear && (String(item.year) === queryYear || (item.releaseInfo && String(item.releaseInfo).startsWith(queryYear)))) score += 25;
      if (selectedTypeFilter && item.type === selectedTypeFilter) score += 15;
      if (item.poster) score += 3;
      if (item.year) score += 2;
      queryWords.forEach(word => { if (descriptionLower.includes(word)) score += 1; });
      if (!item.poster && results.some(r => r.poster)) score -= 10;
      if (!item.year && results.some(r => r.year)) score -= 5;
      return { ...item, relevanceScore: score };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
};


const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const { cinemeta, isLoadingCinemeta, cinemetaError: globalAddonErr } = useAddons();

  const [allResults, setAllResults] = useState([]);
  const [filteredAndSortedResults, setFilteredAndSortedResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  const [selectedType, setSelectedType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const observer = useRef();
  const filterPanelRef = useRef(null);

  const performSearch = useCallback(async (pageToFetch = 0, isNewQueryContext = false) => {
    if (!query || !cinemeta) {
      if(isNewQueryContext) { setAllResults([]); setFilteredAndSortedResults([]); }
      setHasMore(false);
      return;
    }

    if (isNewQueryContext) {
      setIsLoading(true);
      setAllResults([]); // Clear results for a new query or primary filter change
      setCurrentPage(0);  // Reset page number
      setHasMore(true);   // Assume there are more items initially
    } else {
      setIsLoadingMore(true);
    }
    setSearchError('');

    try {
      let movieResults = [], seriesResults = [];
      const searchExtra = { search: query, skip: pageToFetch * ITEMS_PER_PAGE };

      const fetchPromises = [];
      if (selectedType === 'movie' || selectedType === '') {
        fetchPromises.push(cinemeta.get('catalog', 'movie', 'search', searchExtra).catch(e => ({ metas: [] })));
      } else {
        fetchPromises.push(Promise.resolve({ metas: [] }));
      }
      if (selectedType === 'series' || selectedType === '') {
        fetchPromises.push(cinemeta.get('catalog', 'series', 'search', searchExtra).catch(e => ({ metas: [] })));
      } else {
        fetchPromises.push(Promise.resolve({ metas: [] }));
      }
      
      const [movieResponse, seriesResponse] = await Promise.all(fetchPromises);

      movieResults = (movieResponse.metas || []).map(m => ({ ...m, type: 'movie' }));
      seriesResults = (seriesResponse.metas || []).map(s => ({ ...s, type: 'series' }));
      
      let newFetchedItems = [];
      let itemsExpectedThisFetch = 0;

      if (selectedType === 'movie') {
        newFetchedItems = movieResults;
        itemsExpectedThisFetch = ITEMS_PER_PAGE;
      } else if (selectedType === 'series') {
        newFetchedItems = seriesResults;
        itemsExpectedThisFetch = ITEMS_PER_PAGE;
      } else { // 'all' types
        newFetchedItems = interleaveArrays(movieResults, seriesResults);
        itemsExpectedThisFetch = ITEMS_PER_PAGE * 2; // Expecting from both types
      }
      
      const uniqueNewItems = Array.from(new Map(newFetchedItems.filter(item => item && item.id).map(item => [item.id, item])).values());
      
      setAllResults(prevResults => isNewQueryContext ? uniqueNewItems : [...prevResults, ...uniqueNewItems]);
      setHasMore(uniqueNewItems.length >= itemsExpectedThisFetch);
      
      if (isNewQueryContext && uniqueNewItems.length === 0) {
         setSearchError(`No results found for "${query}" ${selectedType ? `of type "${selectedType}"` : ''}.`);
      }
    } catch (e) {
      console.error('SearchResults: General error during search execution:', e);
      setSearchError(`Search failed: ${e.message}.`);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [query, cinemeta, selectedType]);

  // Effect for handling new search query or addon changes
  useEffect(() => {
    window.scrollTo(0, 0);
    if (isLoadingCinemeta) { setSearchError("Initializing addon service..."); return; }
    if (globalAddonErr) { setSearchError(`Cinemeta Addon Error: ${globalAddonErr}`); return; }
    if (!cinemeta && !isLoadingCinemeta) { setSearchError("Cinemeta addon not available."); return; }
    
    if (!query) { 
        setAllResults([]); 
        setFilteredAndSortedResults([]); 
        setSearchError('Please enter a search term.'); 
        setSelectedType(''); setSelectedGenre(''); setSelectedYear('');
        return; 
    }
    // New query, so reset panel filters and treat as new context for performSearch
    setSelectedGenre(''); 
    setSelectedYear('');
    performSearch(0, true);
  }, [query, cinemeta, isLoadingCinemeta, globalAddonErr]); // performSearch removed

  // Effect for re-fetching when selectedType (primary filter) changes
  useEffect(() => {
    if (query && cinemeta && !isLoadingCinemeta && !globalAddonErr) {
      performSearch(0, true); // Treat as a new query context
    }
  }, [selectedType]); // performSearch removed

  // Effect for secondary filtering (Genre/Year) and sorting
  useEffect(() => {
    let itemsToProcess = [...allResults];
    if (selectedGenre) {
      itemsToProcess = itemsToProcess.filter(item => 
        (item.genres && item.genres.map(g => String(g).toLowerCase()).includes(selectedGenre.toLowerCase())) ||
        (typeof item.genre === 'string' && item.genre.toLowerCase().includes(selectedGenre.toLowerCase()))
      );
    }
    if (selectedYear) {
      itemsToProcess = itemsToProcess.filter(item => 
        (item.year && String(item.year) === selectedYear) ||
        (item.releaseInfo && String(item.releaseInfo).startsWith(selectedYear))
      );
    }
    const sortedItems = scoreAndSortSearchResults(itemsToProcess, query, selectedType);
    setFilteredAndSortedResults(sortedItems);
  }, [selectedGenre, selectedYear, allResults, query, selectedType]);

  const availableGenres = useMemo(() => { /* ... (no change) ... */
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

  const availableYears = useMemo(() => { /* ... (no change) ... */
    const years = new Set();
    allResults.forEach(item => {
      let yearStr = null;
      if (item.year) yearStr = String(item.year);
      else if (item.releaseInfo) yearStr = String(item.releaseInfo).substring(0, 4);
      if (yearStr && /^\d{4}$/.test(yearStr)) years.add(yearStr);
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
   }, [allResults]);

  const handleResetPanelFilters = () => { setSelectedGenre(''); setSelectedYear(''); };
  const toggleFilterVisibility = () => setShowFilters(prev => !prev);

  useEffect(() => { /* ... (no change to click outside logic) ... */
    const handleClickOutside = (event) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(event.target)) {
        const toggleButton = document.getElementById('search-filter-toggle-button');
        if (toggleButton && !toggleButton.contains(event.target)) setShowFilters(false);
      }
    };
    if (showFilters) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

  // Infinite scroll observer
  const lastItemElementRef = useCallback(node => {
    if (isLoadingMore || isLoading) return; // Do not re-attach if already loading
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setCurrentPage(prevPage => {
          const nextPageToFetch = prevPage + 1;
          performSearch(nextPageToFetch, false); // false for isNewQueryContext
          return nextPageToFetch; 
        });
      }
    }, { rootMargin: "300px 0px" }); // Trigger 300px before element is visible
    if (node) observer.current.observe(node);
  }, [isLoadingMore, isLoading, hasMore, performSearch]);


  if (isLoadingCinemeta && !filteredAndSortedResults.length) return <div className="page-container search-results-page"><div className="loading-message">Initializing...</div></div>;
  if (!query && !isLoadingCinemeta && !globalAddonErr && !cinemeta) return <div className="page-container search-results-page"><div className="empty-message">Enter a search query.</div></div>;

  return (
    <div className="page-container search-results-page">
      <main className="page-main-content">
        <div className="search-results-header">
          {query ? <h1 className="page-title">Results for: <span className="search-query-highlight">{query}</span></h1> : <h1 className="page-title">Enter search query.</h1>}
          <div className="search-controls">
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="filter-select main-type-select" disabled={isLoading || isLoadingCinemeta}>
              <option value="">All Types</option>
              <option value="movie">Movies</option>
              <option value="series">Series</option>
            </select>
            {(allResults.length > 0 || (isLoading && query && !searchError)) && !globalAddonErr && cinemeta && (
              <button onClick={toggleFilterVisibility} className={`toggle-filters-btn icon-button ${showFilters ? 'active' : ''}`} id="search-filter-toggle-button" aria-expanded={showFilters}>
                <FilterIcon />
                <span>Filters</span>
              </button>
            )}
          </div>
        </div>
        
        <div className={`filters-panel-container ${showFilters ? 'open' : ''}`} ref={filterPanelRef}>
          {showFilters && (allResults.length > 0 || isLoading) && query && !globalAddonErr && cinemeta && (
            <div className="filters-panel active">
              <div className="filter-group">
                <label htmlFor="search-genre-filter">Genre</label>
                <select id="search-genre-filter" value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="filter-select" disabled={isLoading || isLoadingMore || availableGenres.length === 0}>
                  <option value="">All Genres</option>{availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="search-year-filter">Year</label>
                <select id="search-year-filter" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="filter-select" disabled={isLoading || isLoadingMore || availableYears.length === 0}>
                  <option value="">All Years</option>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={handleResetPanelFilters} className="filter-reset-btn" disabled={isLoading || isLoadingMore}>Clear Genre/Year</button>
            </div>
          )}
        </div>

        {isLoading && !isLoadingMore && <div className="loading-message">Searching...</div>}
        {searchError && !isLoading && !isLoadingMore && filteredAndSortedResults.length === 0 && <div className="error-message search-results-error">{searchError}</div>}
        
        {!isLoading && !searchError && filteredAndSortedResults.length === 0 && allResults.length > 0 && ( /* This means filters resulted in no items */
          <div className="empty-message">No items match your current filters for "{query}".</div>
        )}
        
        {/* Grid should always render if there are items, even if loading more */}
        {filteredAndSortedResults.length > 0 && (
          <div className="media-grid search-results-grid">
            {filteredAndSortedResults.map((item, index) => {
               const key = item.id ? `${item.id}-${index}` : `search-result-${index}`; // Ensure unique key
               if (filteredAndSortedResults.length === index + 1 && hasMore && !isLoadingMore) {
                 return <div ref={lastItemElementRef} key={key}><MediaGridItem item={item} /></div>;
               }
               return <MediaGridItem key={key} item={item} />;
            })}
          </div>
        )}
        {isLoadingMore && <div className="loading-message" style={{padding: "20px", textAlign: "center"}}>Loading more...</div>}
        {!isLoadingMore && !hasMore && filteredAndSortedResults.length > 0 && !isLoading && (
            <div className="empty-message" style={{padding: "20px", textAlign: "center"}}>End of results.</div>
        )}
      </main>
    </div>
  );
};

export default SearchResults;