import React, { useState, useEffect } from 'react';
import { Search, Download, Play, AlertCircle } from 'lucide-react';

const API_BASE_URL = 'https://188-245-179-212.nip.io';

const SearchPage = ({ onSelectTorrent }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('dune');
  const [error, setError] = useState(null);

  const searchTorrents = async (query) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Starting search for:', query);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/api/search?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Search response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search response error:', errorText);
        throw new Error(`Search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Search data received:', data);
      
      if (data.Results) {
        setSearchResults(data.Results);
        console.log('Found', data.Results.length, 'results');
      } else {
        console.log('No Results field in response:', data);
        setSearchResults([]);
      }
      
    } catch (error) {
      console.error('Search error details:', error);
      setError(error.message);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchTorrents(searchQuery.trim());
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isVideoFile = (title) => {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    return videoExtensions.some(ext => title.toLowerCase().includes(ext.toLowerCase())) ||
           title.toLowerCase().includes('1080p') || 
           title.toLowerCase().includes('720p') ||
           title.toLowerCase().includes('web-dl') ||
           title.toLowerCase().includes('bluray');
  };

  // Auto-search for "dune" on component mount, but with a delay to ensure auth is ready
  useEffect(() => {
    const timer = setTimeout(() => {
      const token = localStorage.getItem('token');
      if (token) {
        searchTorrents('dune');
      } else {
        console.log('No token available yet, skipping auto-search');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Search Form */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for movies/shows..."
              className="w-full pl-10 pr-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg flex items-center gap-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Search size={20} />
            )}
            Search
          </button>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Search Error:</p>
            <p className="text-sm">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300 text-sm underline mt-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center text-white py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Searching torrents...</p>
        </div>
      )}

      {/* Results */}
      {!loading && searchResults.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-white text-xl mb-4">
            Found {searchResults.length} results for "{searchQuery}"
          </h2>
          
          {searchResults
            .filter(result => isVideoFile(result.Title))
            .slice(0, 20)
            .map((result, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-white font-semibold text-lg flex-1 mr-4">
                  {result.Title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Download size={16} />
                    {result.Seeders || 0} seeds
                  </span>
                  <span>{formatFileSize(result.Size)}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-gray-400 text-sm">
                  <span className="bg-gray-700 px-2 py-1 rounded mr-2">
                    {result.CategoryDesc || 'Video'}
                  </span>
                  {result.PublishDate && (
                    <span>Published: {new Date(result.PublishDate).toLocaleDateString()}</span>
                  )}
                </div>
                
                <button
                  onClick={() => onSelectTorrent(result.MagnetUri, result.Title)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
                  disabled={!result.MagnetUri}
                >
                  <Play size={16} />
                  Stream
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && searchResults.length === 0 && searchQuery && !error && (
        <div className="text-center text-gray-400 py-12">
          <p>No results found for "{searchQuery}"</p>
          <p className="text-sm mt-2">Try a different search term</p>
        </div>
      )}

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-800 rounded text-white text-xs">
          <p><strong>Debug Info:</strong></p>
          <p>API Base URL: {API_BASE_URL}</p>
          <p>Token: {localStorage.getItem('token') ? 'Present' : 'Missing'}</p>
          <p>Search Query: {searchQuery}</p>
          <p>Results Count: {searchResults.length}</p>
          <p>Error: {error || 'None'}</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;