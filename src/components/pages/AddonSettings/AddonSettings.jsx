import React, { useState, useEffect } from 'react';
import AddonClient from 'stremio-addon-client';
import './AddonSettings.css';
import { useAddons } from '../../contexts/AddonContext'; 

const AddonSettings = () => {
  const [addonUrlInput, setAddonUrlInput] = useState('');
  const [addonUrls, setAddonUrls] = useState([]); 
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { refreshCinemeta } = useAddons();

  useEffect(() => {
    try {
      const storedAddonsRaw = localStorage.getItem('stremioUserAddons');
      if (storedAddonsRaw) {
        const storedAddons = JSON.parse(storedAddonsRaw);
        const validatedAddons = storedAddons.map(addon => ({
            ...addon,
            manifest: addon.manifest || { name: `Addon at ${addon.url}`, id: `custom-${Date.now()}` } // Provide a fallback manifest shell
        }));
        setAddonUrls(validatedAddons);
      }
    } catch (e) {
        console.error("Error loading addons from localStorage:", e);
        setAddonUrls([]); 
    }
  }, []);

  const isValidHttpUrl = (string) => {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const handleAddAddon = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!addonUrlInput.trim()) {
      setError('Please enter an addon URL.');
      return;
    }
    const trimmedUrl = addonUrlInput.trim();
    if (!isValidHttpUrl(trimmedUrl)) {
      setError('Invalid URL. Please enter a valid HTTP/HTTPS URL (usually ending with /manifest.json).');
      return;
    }
    if (addonUrls.find(addon => addon.url === trimmedUrl)) {
      setError('This addon URL has already been added.');
      return;
    }

    setIsLoading(true);
    try {
      const detectionResult = await AddonClient.detectFromURL(trimmedUrl);
      let detectedAddonInterface;

      if (detectionResult && detectionResult.addon) {
        detectedAddonInterface = detectionResult.addon;
      } else if (detectionResult && Array.isArray(detectionResult.addons) && detectionResult.addons.length > 0) {
        detectedAddonInterface = detectionResult.addons[0];
      } else if (detectionResult && detectionResult.manifest) {
        detectedAddonInterface = detectionResult; 
      } else {
        throw new Error('Could not detect a valid addon structure from the URL.');
      }

      if (!detectedAddonInterface || !detectedAddonInterface.manifest) {
        throw new Error('Detected addon interface is missing a manifest.');
      }
      
      const { manifest } = detectedAddonInterface;
      const addonName = manifest.name || `Addon at ${new URL(trimmedUrl).hostname}`;
      // Use manifest.id if available, otherwise generate one. 
      const addonId = manifest.id || `custom-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      if (manifest.id && addonUrls.find(addon => addon.id === manifest.id)) {
          setError(`An addon with ID "${manifest.id}" (${addonName}) is already listed. You might want to remove the existing one first if this is an update.`);
          setIsLoading(false);
          return;
      }

      console.log("AddonSettings: Fetched manifest for new addon:", JSON.stringify(manifest, null, 2));


      const newAddonEntry = { 
        id: addonId,
        url: trimmedUrl, 
        name: addonName, 
        manifest: manifest 
      };
      
      const updatedAddons = [...addonUrls, newAddonEntry];
      setAddonUrls(updatedAddons);
      localStorage.setItem('stremioUserAddons', JSON.stringify(updatedAddons));
      setSuccessMessage(`Addon "${addonName}" (ID: ${manifest.id}) added! Refreshing...`);
      setAddonUrlInput('');
      refreshCinemeta(); 
    } catch (err) {
      setError(`Failed to add or detect addon. Error: ${err.message}. (Check URL, CORS, or manifest content)`);
      console.error("AddonSettings: Error adding/detecting addon:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAddon = (addonIdToRemove) => {
    const addonToRemove = addonUrls.find(addon => addon.id === addonIdToRemove);
    const updatedAddons = addonUrls.filter(addon => addon.id !== addonIdToRemove);
    setAddonUrls(updatedAddons);
    localStorage.setItem('stremioUserAddons', JSON.stringify(updatedAddons));
    setSuccessMessage(addonToRemove ? `Addon "${addonToRemove.name}" removed.` : 'Addon removed.');
    refreshCinemeta();
  };

  return (
    <div className="page-container addon-settings-page">
      <main className="page-main-content">
        <h1 className="page-title">Addon Settings</h1>
        
        <form onSubmit={handleAddAddon} className="addon-form">
          <p className="form-description">
            Enter the URL of the Stremio addon manifest (e.g., ending in /manifest.json).
          </p>
          <div className="form-group">
            <label htmlFor="addonUrl">Addon Manifest URL</label>
            <input
              type="text"
              id="addonUrl"
              value={addonUrlInput}
              onChange={(e) => setAddonUrlInput(e.target.value)}
              placeholder="https://v3-cinemeta.strem.io/manifest.json"
              className="addon-url-input"
              disabled={isLoading}
            />
          </div>
          {error && <p className="error-message settings-error">{error}</p>}
          {successMessage && <p className="success-message settings-success">{successMessage}</p>}
          <button type="submit" className="addon-submit-button" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Add Addon'}
          </button>
        </form>

        <div className="added-addons-list">
          <h2 className="list-title">Installed Addons</h2>
          {addonUrls.length > 0 ? (
            <ul>
              {addonUrls.map((addon) => (
                <li key={addon.id || addon.url} className="addon-item"> 
                  <div>
                    <span className="addon-name">{addon.name || 'Unnamed Addon'}</span>
                    <span className="addon-url-display"> (ID: {addon.id || 'N/A'}, URL: {addon.url})</span>
                    <details>
                        <summary style={{cursor: 'pointer', fontSize: '0.8em'}}>View Manifest</summary>
                        <pre style={{fontSize: '0.7em', maxHeight: '100px', overflowY: 'auto', background: '#222', padding: '5px'}}>
                            {JSON.stringify(addon.manifest, null, 2)}
                        </pre>
                    </details>
                  </div>
                  <button onClick={() => handleRemoveAddon(addon.id)} className="remove-addon-button">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-message">No addons installed yet.</p>
          )}
        </div>
         <div className="cors-notice">
            <p><strong>Important:</strong> For addons to work, their servers must allow requests from this website (CORS). If an addon fails, check the console for CORS errors.</p>
        </div>
      </main>
    </div>
  );
};

export default AddonSettings;