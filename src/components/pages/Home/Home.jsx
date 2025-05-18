import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAddons } from '../../contexts/AddonContext'; // Assuming AddonContext.jsx is in src/contexts/
import './HomeStyle.css'; // Your existing styles for Home

// --- Child Components (can be moved to separate files if complex) ---

const HeroSection = ({ item, isLoading }) => {
  // For now, let's make the Hero simple or use a static featured item
  // Or it could fetch a specific "featured" catalog from Cinemeta
  if (isLoading) {
    return (
      <section className="hero-section loading-hero">
        <div className="loading-message">Loading Featured Content...</div>
      </section>
    );
  }

  // Static fallback if no dynamic item is loaded
  const displayItem = item || {
    name: "Welcome to Your Media Hub",
    description: "Discover movies and series from your configured addons.",
    background: "https://via.placeholder.com/1920x700/1a1d24/50535a?text=Featured+Content", // Placeholder
  };

  return (
    <section
      className="hero-section"
      style={{ backgroundImage: `linear-gradient(to top, rgba(14, 16, 21, 0.95) 15%, rgba(14, 16, 21, 0.4) 50%, transparent 100%), url(${displayItem.background || displayItem.poster})` }}
    >
      <div className="hero-content-overlay">
        <div className="hero-content">
          <h1 className="hero-title">{displayItem.name}</h1>
          {displayItem.description && <p className="hero-description">{displayItem.description}</p>}
          {displayItem.id && displayItem.type && ( // Only show button if it's a real item
            <div className="hero-actions">
              <Link to={`/${displayItem.type}/${displayItem.id}`} className="hero-button primary">
                {/* PlayIcon should be imported or defined */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                View Details
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const MediaThumbnail = ({ item }) => {
  if (!item || !item.id || !item.type) {
    // console.warn("MediaThumbnail received incomplete item:", item);
    return null; // Don't render if essential props are missing
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
                {/* You can add more info like year or type if available and desired */}
                {/* {item.year && <span className="thumbnail-year">{item.year}</span>} */}
            </div>
        </div>
    </Link>
  );
};

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
  const [homeCatalogs, setHomeCatalogs] = useState([]); // Stores { key, name, items, isLoading, error, addonInstance, catalogDefinition }
  const [featuredContent, setFeaturedContent] = useState(null);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);


  // Function to fetch items for a specific catalog
  const fetchCatalogItems = useCallback(async (addonInstance, catalogDefinition, catalogKey) => {
    setHomeCatalogs(prev => prev.map(c => 
      c.key === catalogKey ? { ...c, isLoading: true, error: null } : c
    ));
    try {
      // Example: Skip some items for variety, or define specific 'extra' props
      const extra = catalogDefinition.id === 'top' && catalogDefinition.type === 'movie' ? { skip: 0 } : {}; 
      // You can add more sophisticated 'extra' based on catalogDefinition.extraSupported
      
      console.log(`Workspaceing catalog: ${catalogDefinition.name} (Type: ${catalogDefinition.type}, ID: ${catalogDefinition.id}) with extra:`, extra);
      const response = await addonInstance.get('catalog', catalogDefinition.type, catalogDefinition.id, extra);
      
      setHomeCatalogs(prev => prev.map(c =>
        c.key === catalogKey
          ? { ...c, items: response.metas || [], isLoading: false }
          : c
      ));

      // Set featured content from the first item of the first successfully loaded catalog (e.g., top movies)
      if (catalogDefinition.id === 'top' && catalogDefinition.type === 'movie' && (response.metas || []).length > 0) {
        if (!featuredContent) { // Only set once, or implement logic to rotate
            setFeaturedContent(response.metas[0]);
        }
      }

    } catch (error) {
      console.error(`Error fetching catalog ${catalogDefinition.name} from ${addonInstance.manifest.name}:`, error);
      setHomeCatalogs(prev => prev.map(c =>
        c.key === catalogKey
          ? { ...c, isLoading: false, error: `Failed to load: ${error.message}. (Check CORS or addon URL)` }
          : c
      ));
    }
  }, [featuredContent]); // Added featuredContent to dependencies to avoid re-setting it unnecessarily if logic changes


  // Effect to initialize and fetch catalogs when Cinemeta client is ready
  useEffect(() => {
    if (cinemeta && cinemeta.manifest && cinemeta.manifest.catalogs) {
      console.log("Cinemeta loaded, processing catalogs for Home:", cinemeta.manifest.catalogs);
      // Define which catalogs you want on the Home page
      const desiredCatalogs = [
        { type: 'movie', id: 'top', name: 'Top Movies' },
        { type: 'series', id: 'popular', name: 'Popular Series' },
        { type: 'movie', id: 'newest', name: 'New Movies by Genre' }, // This Cinemeta ID might need genre in 'extra'
        // Example: Find a specific genre catalog if available
        // ...(cinemeta.manifest.catalogs.find(c => c.type === 'movie' && c.id.includes('genre') && c.name.toLowerCase().includes('action')) ? [{type: 'movie', id: cinemeta.manifest.catalogs.find(c => c.type === 'movie' && c.id.includes('genre') && c.name.toLowerCase().includes('action')).id, name: 'Action Movies'}] : []),
      ];

      const initialCatalogStates = desiredCatalogs
        .map(dc => {
          const foundCatalog = cinemeta.manifest.catalogs.find(c => c.type === dc.type && c.id === dc.id);
          if (foundCatalog) {
            return {
              key: `${cinemeta.manifest.id}-${foundCatalog.type}-${foundCatalog.id}`,
              name: dc.name, // Use our custom name for the row
              items: [],
              isLoading: true, // Will be set to true by fetchCatalogItems
              error: null,
              addonInstance: cinemeta,
              catalogDefinition: foundCatalog
            };
          }
          return null;
        })
        .filter(Boolean); // Remove nulls if a desired catalog wasn't found in manifest

      setHomeCatalogs(initialCatalogStates);

      // Fetch items for these selected catalogs
      initialCatalogStates.forEach(cs => {
        fetchCatalogItems(cs.addonInstance, cs.catalogDefinition, cs.key);
      });
      
      // Fetch initial featured content (e.g., from top movies)
      const topMoviesCatalog = initialCatalogStates.find(c => c.catalogDefinition.type === 'movie' && c.catalogDefinition.id === 'top');
      if (topMoviesCatalog && !featuredContent) {
          setIsLoadingFeatured(true);
          // fetchCatalogItems will handle setting featuredContent from its items
      }


    } else if (!isLoadingCinemeta && !cinemeta) {
      setHomeCatalogs([]); // Clear catalogs if cinemeta isn't available
    }
  }, [cinemeta, isLoadingCinemeta, fetchCatalogItems]); // Removed featuredContent from here as it's set inside fetchCatalogItems

   useEffect(() => {
    if (featuredContent) setIsLoadingFeatured(false);
   }, [featuredContent]);


  // --- Render Logic ---
  if (isLoadingCinemeta) {
    return <div className="page-container home-page"><div className="loading-message">Initializing Cinemeta addon...</div></div>;
  }

  if (cinemetaError) {
    return <div className="page-container home-page"><div className="error-message global-error" style={{textAlign:'center', padding: '20px'}}>{cinemetaError} Please check Addon Settings.</div></div>;
  }

  if (!cinemeta) {
      return <div className="page-container home-page"><div className="empty-message" style={{textAlign:'center', padding: '20px'}}>Cinemeta addon not loaded. Configure it in settings to see content.</div></div>;
  }

  return (
    <div className="home-container">
      {/* Navbar is rendered by App.js */}
      <main className="home-main-content">
        <HeroSection item={featuredContent} isLoading={isLoadingFeatured} />
        
        {homeCatalogs.length === 0 && !isLoadingCinemeta && (
          <div className="empty-message" style={{textAlign:'center', padding: '20px'}}>No catalogs selected or found from Cinemeta.</div>
        )}

        {homeCatalogs.map((catalogEntry) => (
          <ContentRow
            key={catalogEntry.key}
            title={catalogEntry.name}
            items={catalogEntry.items}
            isLoading={catalogEntry.isLoading}
            error={catalogEntry.error}
          />
        ))}
      </main>
      <footer className="home-footer">
        <p>&copy; {new Date().getFullYear()} STREAMIFY. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;