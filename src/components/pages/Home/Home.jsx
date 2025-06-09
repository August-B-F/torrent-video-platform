import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext';
import ContinueWatchingCard from './ContinueWatchingCard'; 
import './HomeStyle.css';

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

const PlayIconHero = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
);

const HeroSection = ({ items, isLoading }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null); 
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const slideDuration = 30000; 

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
      const progressInterval = 50; 
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
  if (!currentItem) {
    return (
      <section className="hero-section loading-hero">
        <div className="loading-message">Preparing content...</div>
      </section>
    );
  }
  return (
    <section
      key={currentItem.id} 
      className="hero-section"
      style={{ backgroundImage: `url(${currentItem.background || currentItem.poster})` }}
    >
      <div className="hero-background-overlay"></div>
      <div className="hero-content-wrapper"> 
        <div className="hero-content-main">
          <div className="hero-text-content">
            <h1 className="hero-title">{currentItem.name}</h1>
            {currentItem.description && <p className="hero-description">{currentItem.description}</p>}
          </div>
          <div className="hero-actions-and-nav">
            {currentItem.id && currentItem.type && (
              <div className="hero-actions">
                <Link to={`/${currentItem.type}/${currentItem.id}`} className="hero-button primary">
                  <PlayIconHero />
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

const MediaGridItem = ({ item }) => {
    if (!item) return null;
    const detailPath = `/${item.type || 'movie'}/${item.id}`;
    const title = item.name || item.title || 'Untitled';
    return (
      <Link to={detailPath} className="media-thumbnail-link-wrapper" title={title}>
        <div className="media-thumbnail">
          <img
            src={item.poster || 'https://via.placeholder.com/300x450/12151B/FFFFFF?text=No+Poster'}
            alt={title}
            className="thumbnail-image"
            loading="lazy"
          />
          <div className="thumbnail-info">
            <h4 className="thumbnail-title">{title}</h4>
          </div>
        </div>
      </Link>
    );
};

const ContentRow = ({ title, items, isLoading, error, CardComponent = MediaGridItem }) => {
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
    return null; 
  }

  return (
    <section className={`content-row ${title === "Continue Watching" ? 'continue-watching-row' : ''}`}>
      <h3 className="row-title">{title}</h3>
      <div className="row-items-scrollable">
        {items.map(item => (
          <CardComponent key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
};

const Home = () => {
  const { cinemeta, isLoadingCinemeta, cinemetaError } = useAddons();
  const [featuredItems, setFeaturedItems] = useState([]);
  const [continueWatchingItems, setContinueWatchingItems] = useState([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(true);
  const [isLoadingContinueWatching, setIsLoadingContinueWatching] = useState(true);
  const [contentError, setContentError] = useState('');

  const mockWatchedItemsBase = useRef([
    { id: 'tt0816692', type: 'movie', progress: 0.75, mockDuration: 169 * 60 },
    { id: 'tt1375666', type: 'movie', progress: 0.20, mockDuration: 148 * 60 }, 
    { id: 'tt0468569', type: 'movie', progress: 0.30, mockDuration: 152 * 60 },
  ]);
 
  useEffect(() => {
    if (cinemeta && cinemeta.manifest && cinemeta.manifest.catalogs) {
      const topMoviesCatalog = cinemeta.manifest.catalogs.find(c => c.type === 'movie' && c.id === 'top');
      if (topMoviesCatalog) {
        setIsLoadingFeatured(true);
        setContentError('');
        cinemeta.get('catalog', topMoviesCatalog.type, topMoviesCatalog.id, { skip: 0 })
          .then(response => {
            const heroData = (response.metas || []).slice(0, 5).map(item => ({
                ...item,
                name: item.name || item.title, 
                background: item.background || item.fanart || item.poster 
            }));
            setFeaturedItems(heroData);
            if (heroData.length === 0) {
              setContentError("No featured content found from Cinemeta's top movies.");
            }
          })
          .catch(error => {
            console.error("Error fetching top movies for hero:", error);
            setContentError(`Failed to load featured content: ${error.message}.`);
          })
          .finally(() => setIsLoadingFeatured(false));
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
    if (cinemeta && !isLoadingCinemeta && mockWatchedItemsBase.current.length > 0) {
      setIsLoadingContinueWatching(true);
      
      const fetchAllDetails = async () => {
        const detailedItems = await Promise.all(
          mockWatchedItemsBase.current.map(async (watchedItem) => {
            try {
              let metaId = watchedItem.id;

              if (watchedItem.type === 'series' && watchedItem.id.includes(':')) {
                  metaId = watchedItem.id.split(':')[0];
              }
              
              const res = await cinemeta.get('meta', watchedItem.type, metaId);
              if (res && res.meta) {
                let episodeTitle = '';
                if (watchedItem.type === 'series' && watchedItem.idParts) {
                    const ep = res.meta.videos?.find(v => v.season === watchedItem.idParts.season && v.episode === watchedItem.idParts.episode);
                    episodeTitle = ep ? ` - S${String(watchedItem.idParts.season).padStart(2, '0')}E${String(watchedItem.idParts.episode).padStart(2, '0')}${ep.title ? `: ${ep.title}` : ''}` : '';
                }

                return {
                  ...watchedItem, 
                  name: (res.meta.name || res.meta.title || 'Unknown Title') + episodeTitle,
                  poster: res.meta.poster,
                  background: res.meta.background || res.meta.fanart || res.meta.poster,
                  logo: res.meta.logo,
                  runtime: res.meta.runtime, 
                };
              }
            } catch (error) {
              console.error(`Failed to fetch metadata for ${watchedItem.type} ${watchedItem.id}:`, error);
            
              return { 
                  ...watchedItem, 
                  name: `Item ${watchedItem.id}`, 
                  poster: 'https://via.placeholder.com/300x450/12151B/FFFFFF?text=Error',
                  background: 'https://via.placeholder.com/800x450/101215/33363D?text=Error+Loading'
                };
            }
            return null; 
          })
        );
        setContinueWatchingItems(detailedItems.filter(item => item !== null));
        setIsLoadingContinueWatching(false);
      };

      fetchAllDetails();
    } else if (!cinemeta && !isLoadingCinemeta) {
        setIsLoadingContinueWatching(false); 
    }
  }, [cinemeta, isLoadingCinemeta]);


  if (isLoadingCinemeta && isLoadingFeatured && isLoadingContinueWatching) {
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
          CardComponent={ContinueWatchingCard} 
        />
      </main>
    </div>
  );
};

export default Home;