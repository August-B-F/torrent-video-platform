// src/components/contexts/AddonContext.jsx
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AddonClient from 'stremio-addon-client';

export const AddonContext = createContext({
  cinemeta: null,
  isLoadingCinemeta: true,
  cinemetaError: null,
  refreshCinemeta: () => Promise.resolve(),
});

export const AddonProvider = ({ children }) => {
  const [cinemeta, setCinemeta] = useState(null);
  const [isLoadingCinemeta, setIsLoadingCinemeta] = useState(true);
  const [cinemetaError, setCinemetaError] = useState(null);

  const initializeCinemeta = useCallback(async () => {
    setIsLoadingCinemeta(true);
    setCinemetaError(null);
    setCinemeta(null); 

    const storedAddons = JSON.parse(localStorage.getItem('stremioUserAddons') || '[]');
    let cinemetaEntry = storedAddons.find(a => 
        a.name?.toLowerCase().includes('cinemeta') || 
        a.url?.includes('cinemeta.strem.io') || 
        a.manifest?.id === 'com.linvo.cinemeta' || 
        a.id === 'stremio.cinemeta' 
    );

    if (!cinemetaEntry && storedAddons.length === 1) {
        console.warn("AddonContext: Only one addon found, using it as Cinemeta.");
        cinemetaEntry = storedAddons[0];
    }
    
    // console.log("AddonContext: Cinemeta entry:", cinemetaEntry);

    if (cinemetaEntry && cinemetaEntry.url) {
      try {
        // console.log(`AddonContext: Initializing Cinemeta from URL: ${cinemetaEntry.url}`);
        const detectionResult = await AddonClient.detectFromURL(cinemetaEntry.url);
        let addonInterface;

        if (detectionResult && detectionResult.addon) { 
            addonInterface = detectionResult.addon;
        } else if (detectionResult && Array.isArray(detectionResult.addons) && detectionResult.addons.length > 0) { 
            addonInterface = detectionResult.addons[0];
        } else if (detectionResult && detectionResult.manifest) { 
            addonInterface = detectionResult;
        } else {
            throw new Error("Addon detection did not return a recognizable addon structure.");
        }
        
        // console.log("AddonContext: Raw detected addon/collection:", detectionResult);
        // console.log("AddonContext: Chosen addonInterface:", addonInterface);

        if (addonInterface && addonInterface.manifest) {
            console.log("AddonContext: --- START OF MANIFEST DEBUG ---");
            console.log("AddonContext: Manifest ID:", addonInterface.manifest.id);
            console.log("AddonContext: Manifest Name:", addonInterface.manifest.name);
            console.log("AddonContext: Manifest Resources:", JSON.stringify(addonInterface.manifest.resources, null, 2));
            console.log("AddonContext: Manifest Types:", JSON.stringify(addonInterface.manifest.types, null, 2));
            console.log("AddonContext: --- END OF MANIFEST DEBUG ---");
            
            const isRecognizedCinemeta = addonInterface.manifest.id === 'com.linvo.cinemeta' || 
                                         addonInterface.manifest.name?.toLowerCase().includes('cinemeta');

            if (isRecognizedCinemeta) {
                if (typeof addonInterface.get === 'function' && typeof addonInterface.isSupported === 'function') {
                    setCinemeta(addonInterface);
                    console.log(`AddonContext: Cinemeta (id: ${addonInterface.manifest.id}, name: "${addonInterface.manifest.name}") initialized.`);
                } else {
                    throw new Error(`Detected Cinemeta (id: ${addonInterface.manifest.id}) is missing critical methods (get/isSupported).`);
                }
            } else {
                throw new Error(`Detected addon (id: ${addonInterface.manifest.id}, name: "${addonInterface.manifest.name}") is not recognized as Cinemeta.`);
            }
        } else {
            throw new Error("Detected addon interface is missing a manifest.");
        }
      } catch (e) {
        console.error('AddonContext: Critical error initializing Cinemeta:', e);
        setCinemetaError(`Failed to load Cinemeta: ${e.message}. Please check addon URL and console for details.`);
      }
    } else {
      setCinemetaError("Cinemeta addon is not configured. Please add its manifest URL in Settings. Try: https://v3-cinemeta.strem.io/manifest.json");
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