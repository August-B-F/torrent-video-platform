import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link }
from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import './HomeStyle.css';

// --- SVG Icons for Hero Carousel ---
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
);


// --- Updated HeroSection ---
const HeroSection = ({ items, isLoading }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null); // For transition direction
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const progressTimerRef = useRef(null);

  const slideDuration = 30000; // 10 seconds per slide

  const goToIndex = useCallback((index, direction = 'next') => {
    setPrevIndex(currentIndex);
    setCurrentIndex(index);
    setProgress(0);
  }, [currentIndex]);


  const goToNext = useCallback(() => {
    goToIndex((currentIndex + 1) % (items?.length || 1), 'next');
  }, [currentIndex, items, goToIndex]);

  const goToPrevious = () => {
    goToIndex((currentIndex - 1 + (items?.length || 1)) % (items?.length || 1), 'prev');
  };


  useEffect(() => {
    if (items && items.length > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);

      timerRef.current = setInterval(goToNext, slideDuration);

      const progressInterval = 50; // Update progress bar more frequently
      progressTimerRef.current = setInterval(() => {
        setProgress(prev => {
          const nextProgress = prev + (progressInterval / slideDuration) * 100;
          return nextProgress >= 100 ? 100 : nextProgress;
        });
      }, progressInterval);
    }
    return () => {
      clearInterval(timerRef.current);
      clearInterval(progressTimerRef.current);
    };
  }, [items, currentIndex, goToNext, slideDuration]);

  if (isLoading || !items || items.length === 0) {
    return (
      <section className="hero-section loading-hero">
        <div className="loading-message">Loading Featured Content...</div>
      </section>
    );
  }

  const currentItem = items[currentIndex];
   // To help with transitions, we can keep track of the previous item for a moment
  const previousItem = prevIndex !== null && items[prevIndex] ? items[prevIndex] : null;


  if (!currentItem) {
    return (
      <section className="hero-section loading-hero">
        <div className="loading-message">Preparing content...</div>
      </section>
    );
  }

  return (
    // Add a key to the section to help React re-render for transitions
    <section
      key={currentItem.id} // Key change will trigger re-render and CSS transition
      className="hero-section"
      style={{ backgroundImage: `url(${currentItem.background || currentItem.poster})` }}
    >
      <div className="hero-background-overlay"></div> {/* Gradient overlay */}
      <div className="hero-content-wrapper"> {/* Wrapper for content and controls */}
        <div className="hero-content-main">
          {/* Text content with transition */}
          <div className="hero-text-content">
            <h1 className="hero-title">{currentItem.name}</h1>
            {currentItem.description && <p className="hero-description">{currentItem.description}</p>}
          </div>
          <div className="hero-actions-and-nav">
            {currentItem.id && currentItem.type && (
              <div className="hero-actions">
                <Link to={`/${currentItem.type}/${currentItem.id}`} className="hero-button primary">
                  <PlayIcon />
                  View Details
                </Link>
              </div>
            )}
            {items.length > 1 && (
              <div className="hero-nav-arrows-container">
                <button onClick={goToPrevious} className="hero-nav-arrow icon-button" aria-label="Previous slide">
                  <ChevronLeftIcon />
                </button>
                <button onClick={goToNext} className="hero-nav-arrow icon-button" aria-label="Next slide">
                  <ChevronRightIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div className="hero-progress-bar-container">
          <div className="hero-progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </section>
  );
};


// --- MediaThumbnail (can be kept as is or adjusted if needed) ---
const MediaThumbnail = ({ item }) => {
  if (!item || !item.id || !item.type) {
    return null;
  }
  const detailPath = `/${item.type}/${item.id}`;

  return (
    <Link to={detailPath} className="media-thumbnail-link-wrapper" title={item.name || item.title}>
        <div className="media-thumbnail">
            <img
                src={item.poster || item.logo || 'https://via.placeholder.com/300x450/2a2a2a/FFFFFF?text=No+Poster'}
                alt={item.name || item.title || 'Poster'}
                className="thumbnail-image"
                loading="lazy"
            />
            <div className="thumbnail-info">
                <h4 className="thumbnail-title">{item.name || item.title || 'Untitled'}</h4>
            </div>
        </div>
    </Link>
  );
};

// --- ContentRow (can be kept as is or adjusted) ---
const ContentRow = ({ title, items, isLoading, error }) => {
  if (isLoading) {
    return (
      <section className="content-row">
        <h3 className="row-title">{title}</h3>
        <div className="loading-message">Loading items...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="content-row">
        <h3 className="row-title">{title}</h3>
        <p className="error-message" style={{ paddingLeft: '5px', color: 'var(--warning-color)' }}>
          {error}
        </p>
      </section>
    );
  }

  if (!items || items.length === 0) {
    if (title === "Continue Watching") {
        return (
            <section className="content-row">
              <h3 className="row-title">{title}</h3>
              <p className="empty-message" style={{ paddingLeft: '5px', fontStyle: 'italic' }}>Nothing to show here yet. Start watching something!</p>
            </section>
          );
    }
    return (
      <section className="content-row">
        <h3 className="row-title">{title}</h3>
        <p className="empty-message" style={{ paddingLeft: '5px' }}>No items found in this category.</p>
      </section>
    );
  }

  return (
    <section className="content-row">
      <h3 className="row-title">{title}</h3>
      <div className="row-items-scrollable">
        {items.map(item => (
          <MediaThumbnail key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
};


// --- Main Home Component ---
const Home = () => {
  const { cinemeta, isLoadingCinemeta, cinemetaError } = useAddons();
  const [featuredItems, setFeaturedItems] = useState([]);
  const [continueWatchingItems, setContinueWatchingItems] = useState([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(true);
  const [isLoadingContinueWatching, setIsLoadingContinueWatching] = useState(false);
  const [contentError, setContentError] = useState('');


  useEffect(() => {
    if (cinemeta && cinemeta.manifest && cinemeta.manifest.catalogs) {
      const topMoviesCatalog = cinemeta.manifest.catalogs.find(c => c.type === 'movie' && c.id === 'top');
      if (topMoviesCatalog) {
        setIsLoadingFeatured(true);
        setContentError('');
        cinemeta.get('catalog', topMoviesCatalog.type, topMoviesCatalog.id, { skip: 0 })
          .then(response => {
            setFeaturedItems((response.metas || []).slice(0, 5));
            setIsLoadingFeatured(false);
            if ((response.metas || []).length === 0) {
              setContentError("No featured content found from Cinemeta's top movies.");
            }
          })
          .catch(error => {
            console.error("Error fetching top movies for hero:", error);
            setContentError(`Failed to load featured content: ${error.message}.`);
            setIsLoadingFeatured(false);
          });
      } else {
        setContentError("Cinemeta 'top movies' catalog not found in manifest.");
        setIsLoadingFeatured(false);
      }
    }  else if (!isLoadingCinemeta && !cinemeta) {
      setContentError("Cinemeta addon not available. Please configure it in settings.");
      setIsLoadingFeatured(false);
    }
  }, [cinemeta, isLoadingCinemeta]);

  useEffect(() => {
    // Placeholder: Fetch actual continue watching items
    // Example:
    // const mockContinueWatching = [
    //   { id: 'tt0816692', name: 'Interstellar', type: 'movie', poster: 'https://image.tmdb.org/t/p/w300/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg' },
    //   { id: 'tt0468569', name: 'The Dark Knight', type: 'movie', poster: 'https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
    // ];
    // setContinueWatchingItems(mockContinueWatching);
    setIsLoadingContinueWatching(false);
  }, []);


  if (isLoadingCinemeta && isLoadingFeatured) { // Show general loading if both are true initially
    return <div className="page-container home-page"><div className="loading-message">Initializing and loading content...</div></div>;
  }

  if (cinemetaError) {
    return <div className="page-container home-page"><div className="error-message global-error" style={{textAlign:'center', padding: '20px'}}>{cinemetaError} Please check Addon Settings.</div></div>;
  }
   if (!cinemeta && !isLoadingCinemeta) {
       return <div className="page-container home-page"><div className="empty-message" style={{textAlign:'center', padding: '20px'}}>Cinemeta addon not loaded. Configure it in settings to see content.</div></div>;
   }


  return (
    <div className="home-container">
      <main className="home-main-content">
        <HeroSection items={featuredItems} isLoading={isLoadingFeatured} />
        {contentError && !isLoadingFeatured && featuredItems.length === 0 && <p className="error-message" style={{textAlign: 'center', padding: '20px'}}>{contentError}</p>}

        <ContentRow
          title="Continue Watching"
          items={continueWatchingItems}
          isLoading={isLoadingContinueWatching}
        />
      </main>
      <footer className="home-footer">
        <p>&copy; {new Date().getFullYear()} STREAMIFY. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;