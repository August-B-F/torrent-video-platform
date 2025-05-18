import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext'; // Assuming this path is correct
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem'; // Assuming this path
import './SearchResultsStyle.css';

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const { cinemeta, isLoadingCinemeta, cinemetaError: globalAddonErr } = useAddons();

  const [initialResults, setInitialResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Filter states
  const [selectedType, setSelectedType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0); // Scroll to top when query changes
    // Reset filters when a new search query comes in
    setSelectedType('');
    setSelectedGenre('');
    setSelectedYear('');

    if (isLoadingCinemeta) {
      setSearchError("Initializing addon service...");
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
        try {
          let movieResults = [], seriesResults = [];

          // Check if search resource is supported for movie type
          if (cinemeta.isSupported('search', 'movie', query)) {
            const movieResponse = await cinemeta.get('search', 'movie', query);
            movieResults = (movieResponse.metas || []).map(m => ({ ...m, type: 'movie' })); // Ensure type is set
          } else {
            console.warn("Cinemeta does not support 'search' for 'movie' with the current configuration or query format.");
          }

          // Check if search resource is supported for series type
          if (cinemeta.isSupported('search', 'series', query)) {
            const seriesResponse = await cinemeta.get('search', 'series', query);
            seriesResults = (seriesResponse.metas || []).map(s => ({ ...s, type: 'series' })); // Ensure type is set
          } else {
            console.warn("Cinemeta does not support 'search' for 'series' with the current configuration or query format.");
          }
          
          const combinedResults = [...movieResults, ...seriesResults];
          const uniqueResults = Array.from(new Map(combinedResults.map(item => [item.id, item])).values());

          setInitialResults(uniqueResults);
          setFilteredResults(uniqueResults); // Initialize filtered results
          
          if (uniqueResults.length === 0) {
            setSearchError(`No results found for "${query}".`);
          }
        } catch (e) {
          console.error('Error during Cinemeta search:', e);
          setSearchError(`Search failed: ${e.message}. This could be a problem with the addon or your connection.`);
        } finally {
          setIsLoading(false);
        }
      };
      performSearch();
    } else if (!query) {
      setInitialResults([]);
      setFilteredResults([]);
      setSearchError('Please enter a search term in the navigation bar to see results.');
    }
  }, [query, cinemeta, isLoadingCinemeta, globalAddonErr]);

  const availableGenres = useMemo(() => {
    const genres = new Set();
    initialResults.forEach(item => {
      if (item.genres && Array.isArray(item.genres)) { 
        item.genres.forEach(g => genres.add(g)); 
      } else if (typeof item.genre === 'string') { // Handle cases where genre is a string
        item.genre.split(',').forEach(g => genres.add(g.trim()));
      }
    });
    return Array.from(genres).sort();
  }, [initialResults]);

  const availableYears = useMemo(() => {
    const years = new Set();
    initialResults.forEach(item => {
      if (item.year) {
        years.add(String(item.year));
      } else if (item.releaseInfo) { // Cinemeta often uses releaseInfo for year
        const yearStr = String(item.releaseInfo).substring(0, 4);
        if (/^\d{4}$/.test(yearStr)) {
          years.add(yearStr);
        }
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)); // Descending
  }, [initialResults]);

  useEffect(() => {
    let itemsToFilter = [...initialResults];
    if (selectedType) {
      itemsToFilter = itemsToFilter.filter(item => item.type === selectedType);
    }
    if (selectedGenre) {
      itemsToFilter = itemsToFilter.filter(item => 
        (item.genres && item.genres.includes(selectedGenre)) ||
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
    setFilteredResults(initialResults); // Reset to all initial search results
  };

  if (isLoadingCinemeta && !query) { // Only show addon loading if no query active yet
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
          <h1 className="page-title">Enter a search term.</h1>
        )}
        
        {(initialResults.length > 0 || isLoading) && !searchError && ( // Show filters if there are results OR still loading them
          <div className="filters-panel">
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="filter-select">
              <option value="">All Types</option>
              <option value="movie">Movies</option>
              <option value="series">Series</option>
            </select>
            <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="filter-select" disabled={availableGenres.length === 0 && !isLoading}>
              <option value="">All Genres</option>
              {availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="filter-select" disabled={availableYears.length === 0 && !isLoading}>
              <option value="">All Years</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleResetFilters} className="filter-reset-btn">Reset Filters</button>
          </div>
        )}

        {isLoading && <div className="loading-message">Searching...</div>}
        {searchError && !isLoading && <div className="empty-message" style={{textAlign:'center', padding: '20px'}}>{searchError}</div>}
        
        {!isLoading && !searchError && filteredResults.length > 0 && (
          <div className="media-grid">
            {filteredResults.map(item => (
              // MediaGridItem expects item.posterUrl, item.title, item.id, item.type
              // Cinemeta 'meta' objects usually have 'poster', 'name', 'id', 'type'
              <MediaGridItem 
                key={item.id} 
                item={{
                  id: item.id,
                  title: item.name, // Cinemeta uses 'name'
                  posterUrl: item.poster, // Cinemeta uses 'poster'
                  type: item.type // Ensure type is passed
                }} 
              />
            ))}
          </div>
        )}
        {/* Message if filters result in no items, but initial search had results */}
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