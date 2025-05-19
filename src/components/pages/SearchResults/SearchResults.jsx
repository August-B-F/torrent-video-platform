import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import './SearchResultsStyle.css';

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const { cinemeta, isLoadingCinemeta, cinemetaError: globalAddonErr } = useAddons();

  const [initialResults, setInitialResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [selectedType, setSelectedType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedType('');
    setSelectedGenre('');
    setSelectedYear('');

    if (isLoadingCinemeta) {
      setSearchError("Initializing addon service...");
      setInitialResults([]);
      setFilteredResults([]);
      return;
    }
    if (!cinemeta && !globalAddonErr) {
      setSearchError("Cinemeta addon not available for searching. Please configure it in settings.");
      setInitialResults([]);
      setFilteredResults([]);
      return;
    }
    if (globalAddonErr) {
      setSearchError(`Cinemeta Error: ${globalAddonErr}`);
      setInitialResults([]);
      setFilteredResults([]);
      return;
    }

    if (query && cinemeta) {
      const performSearch = async () => {
        setIsLoading(true);
        setSearchError('');
        setInitialResults([]);
        setFilteredResults([]);
        console.log(`SearchResults: Performing search for: "${query}"`);
        console.log("SearchResults: Using Cinemeta Manifest ID:", cinemeta.manifest?.id, "Name:", cinemeta.manifest?.name);
        // Also log the resources from the cinemeta object being used HERE
        console.log("SearchResults: Cinemeta object resources being used for search:", JSON.stringify(cinemeta.manifest?.resources));


        try {
          let movieResults = [], seriesResults = [];
          
          const movieSearchRequestArgs = { resource: 'search', type: 'movie', id: query };
          const seriesSearchRequestArgs = { resource: 'search', type: 'series', id: query };

          if (typeof cinemeta.get !== 'function') {
            setSearchError("Cinemeta addon 'get' method is not available. Addon may be corrupted or not fully initialized.");
            setIsLoading(false);
            return;
          }
          
          // Check if the manifest *actually* being used by this cinemeta instance supports search
          const manifestSupportsSearch = cinemeta.manifest?.resources?.includes('search') ||
                                       (Array.isArray(cinemeta.manifest?.resources) && cinemeta.manifest.resources.some(r => typeof r === 'object' && r.name === 'search'));

          if (!manifestSupportsSearch) {
            console.error(`SearchResults: CRITICAL - The loaded Cinemeta manifest for ID ${cinemeta.manifest?.id} does NOT list 'search' in its resources. Resources found: ${JSON.stringify(cinemeta.manifest?.resources)}. Search will fail.`);
            setSearchError(`The configured metadata addon (Cinemeta ID: ${cinemeta.manifest?.id}) does not support the 'search' function according to its manifest. Please check addon settings or re-add the official Cinemeta addon.`);
            setIsLoading(false);
            return;
          }

          // --- Movie Search ---
          try {
            console.log("SearchResults: Attempting direct GET for movie search:", movieSearchRequestArgs);
            // Using the documented way to call .get with separate arguments
            const movieResponse = await cinemeta.get(movieSearchRequestArgs.resource, movieSearchRequestArgs.type, movieSearchRequestArgs.id);
            console.log("SearchResults: Movie search direct GET response:", movieResponse);
            movieResults = (movieResponse.metas || []).map(m => ({ ...m, type: 'movie' }));
          } catch (movieError) {
            console.warn(`SearchResults: Direct GET for movie search failed for query "${query}". Error:`, movieError.message, movieError);
            if (movieError.code === 6) { // Stremio error code for "Resource not supported"
                console.warn(`Cinemeta (id: ${cinemeta?.manifest?.id}) reports it does NOT support 'search' for 'movie' (via direct get).`);
            }
          }

          // --- Series Search ---
          try {
            console.log("SearchResults: Attempting direct GET for series search:", seriesSearchRequestArgs);
            const seriesResponse = await cinemeta.get(seriesSearchRequestArgs.resource, seriesSearchRequestArgs.type, seriesSearchRequestArgs.id);
            console.log("SearchResults: Series search direct GET response:", seriesResponse);
            seriesResults = (seriesResponse.metas || []).map(s => ({ ...s, type: 'series' }));
          } catch (seriesError) {
            console.warn(`SearchResults: Direct GET for series search failed for query "${query}". Error:`, seriesError.message, seriesError);
            if (seriesError.code === 6) {
                console.warn(`Cinemeta (id: ${cinemeta?.manifest?.id}) reports it does NOT support 'search' for 'series' (via direct get).`);
            }
          }
          
          const combinedResults = [...movieResults, ...seriesResults];
          const uniqueResults = Array.from(new Map(combinedResults.filter(item => item && item.id).map(item => [item.id, item])).values());
          console.log("SearchResults: Unique combined search results from direct GET attempts:", uniqueResults);

          setInitialResults(uniqueResults);
          setFilteredResults(uniqueResults);
          
          if (uniqueResults.length === 0) {
             setSearchError(`No results found for "${query}". If you expected results, check the console for addon errors.`);
          }
        } catch (e) {
          console.error('SearchResults: General error during search execution:', e);
          setSearchError(`Search failed: ${e.message}.`);
        } finally {
          setIsLoading(false);
        }
      };
      performSearch();
    } else if (!query) {
      setInitialResults([]);
      setFilteredResults([]);
      setSearchError('Please enter a search term to see results.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cinemeta, isLoadingCinemeta, globalAddonErr]);

  const availableGenres = useMemo(() => {
    const genres = new Set();
    initialResults.forEach(item => {
      if (item.genres && Array.isArray(item.genres)) { 
        item.genres.forEach(g => { if (g) genres.add(g); }); 
      } else if (typeof item.genre === 'string' && item.genre.trim()) { 
        item.genre.split(',').forEach(g => { if (g && g.trim()) genres.add(g.trim()); });
      }
    });
    return Array.from(genres).sort();
  }, [initialResults]);

  const availableYears = useMemo(() => {
    const years = new Set();
    initialResults.forEach(item => {
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
  }, [initialResults]);

  useEffect(() => {
    let itemsToFilter = [...initialResults];
    if (selectedType) {
      itemsToFilter = itemsToFilter.filter(item => item.type === selectedType);
    }
    if (selectedGenre) {
      itemsToFilter = itemsToFilter.filter(item => 
        (item.genres && item.genres.map(g => String(g).toLowerCase()).includes(selectedGenre.toLowerCase())) ||
        (typeof item.genre === 'string' && item.genre.toLowerCase().includes(selectedGenre.toLowerCase()))
      );
    }
    if (selectedYear) {
      itemsToFilter = itemsToFilter.filter(item => 
        (item.year && String(item.year) === selectedYear) ||
        (item.releaseInfo && String(item.releaseInfo).startsWith(selectedYear))
      );
    }
    setFilteredResults(itemsToFilter);
  }, [selectedType, selectedGenre, selectedYear, initialResults]);

  const handleResetFilters = () => {
    setSelectedType('');
    setSelectedGenre('');
    setSelectedYear('');
  };

  if (isLoadingCinemeta && !query) {
    return <div className="page-container"><div className="loading-message">Initializing addon service...</div></div>;
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
        
        {(initialResults.length > 0 || isLoading) && !searchError && (
          <div className="filters-panel">
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="filter-select" disabled={isLoading}>
              <option value="">All Types</option>
              <option value="movie">Movies</option>
              <option value="series">Series</option>
            </select>
            <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="filter-select" disabled={isLoading || availableGenres.length === 0}>
              <option value="">All Genres</option>
              {availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="filter-select" disabled={isLoading || availableYears.length === 0}>
              <option value="">All Years</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleResetFilters} className="filter-reset-btn" disabled={isLoading}>Reset Filters</button>
          </div>
        )}

        {isLoading && <div className="loading-message">Searching...</div>}
        {searchError && !isLoading && <div className="empty-message" style={{textAlign:'center', padding: '20px'}}>{searchError}</div>}
        
        {!isLoading && !searchError && filteredResults.length > 0 && (
          <div className="media-grid search-results-grid">
            {filteredResults.map((item, index) => (
              <MediaGridItem 
                key={item.id || `search-result-${index}`}
                item={{
                  id: item.id,
                  name: item.name, 
                  title: item.title || item.name,
                  posterUrl: item.posterUrl || item.poster, 
                  type: item.type 
                }} 
              />
            ))}
          </div>
        )}
        {!isLoading && !searchError && query && filteredResults.length === 0 && initialResults.length > 0 && (
          <div className="empty-message" style={{textAlign:'center', padding: '20px'}}>
            No items match your current filters for "{query}".
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchResults;