import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AddonClient from 'stremio-addon-client';

export const AddonContext = createContext({
  cinemeta: null,
  isLoadingCinemeta: true,
  cinemetaError: null,
  refreshCinemeta: () => Promise.resolve(), // Function to allow re-initialization
});

export const AddonProvider = ({ children }) => {
  const [cinemeta, setCinemeta] = useState(null);
  const [isLoadingCinemeta, setIsLoadingCinemeta] = useState(true);
  const [cinemetaError, setCinemetaError] = useState(null);

  const initializeCinemeta = useCallback(async () => {
    setIsLoadingCinemeta(true);
    setCinemetaError(null);
    setCinemeta(null); // Clear previous instance

    const storedAddons = JSON.parse(localStorage.getItem('stremioUserAddons') || '[]');
    // Try to find an addon explicitly named or URL-matched to Cinemeta
    let cinemetaEntry = storedAddons.find(a => 
        a.name?.toLowerCase().includes('cinemeta') || 
        a.url?.includes('cinemeta.strem.io') ||
        a.id === 'stremio.cinemeta' // Official Cinemeta v3 ID
    );

    // If not found by specific identifiers, and only one addon is configured, assume it's Cinemeta
    if (!cinemetaEntry && storedAddons.length === 1) {
        console.warn("Only one addon found, attempting to use it as Cinemeta. Please ensure it's a Cinemeta manifest URL in settings.");
        cinemetaEntry = storedAddons[0];
    }


    if (cinemetaEntry && cinemetaEntry.url) {
      try {
        console.log(`Initializing Cinemeta from URL: ${cinemetaEntry.url}`);
        const { addon } = await AddonClient.detectFromURL(cinemetaEntry.url);
        // detectFromURL can return an AddonCollection or AddonInterface
        const cinemetaInterface = addon.addons && addon.addons.length > 0 ? addon.addons[0] : addon;
        
        if (cinemetaInterface && cinemetaInterface.manifest && (cinemetaInterface.manifest.id === 'stremio.cinemeta' || cinemetaInterface.manifest.name?.toLowerCase().includes('cinemeta'))) {
            setCinemeta(cinemetaInterface);
            console.log('Cinemeta initialized successfully:', cinemetaInterface.manifest);
        } else {
            throw new Error("Detected addon is not Cinemeta or manifest is incompatible.");
        }
      } catch (e) {
        console.error('Failed to initialize Cinemeta:', e);
        setCinemetaError(`Failed to load Cinemeta from "${cinemetaEntry.name || cinemetaEntry.url}": ${e.message}. Check URL and CORS.`);
      }
    } else {
      setCinemetaError("Cinemeta addon is not configured. Please add its manifest URL in Settings > Manage Addons. Recommended: https://cinemeta-live.strem.io/manifest.json");
    }
    setIsLoadingCinemeta(false);
  }, []);

  useEffect(() => {
    initializeCinemeta();
  }, [initializeCinemeta]);

  return (
    <AddonContext.Provider value={{ cinemeta, isLoadingCinemeta, cinemetaError, refreshCinemeta: initializeCinemeta }}>
      {children}
    </AddonContext.Provider>
  );
};

export const useAddons = () => useContext(AddonContext);