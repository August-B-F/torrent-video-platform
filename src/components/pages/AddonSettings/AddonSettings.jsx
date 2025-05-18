import React, { useState, useEffect } from 'react';
import AddonClient from 'stremio-addon-client'; // Import the client
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
    const storedAddons = JSON.parse(localStorage.getItem('stremioUserAddons') || '[]');
    setAddonUrls(storedAddons);
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
      setError('Invalid URL. Please enter a valid HTTP/HTTPS URL ending with /manifest.json (usually).');
      return;
    }
    if (addonUrls.find(addon => addon.url === trimmedUrl)) {
      setError('This addon URL has already been added.');
      return;
    }

    setIsLoading(true);
    try {
      const { addon } = await AddonClient.detectFromURL(trimmedUrl);
      let addonName = 'Unnamed Addon';
      let addonId = `custom-${Date.now()}`;
      let manifest = null;

      if (addon && addon.manifest) {
        manifest = addon.manifest;
        addonName = manifest.name || `Addon at ${new URL(trimmedUrl).hostname}`;
        addonId = manifest.id || addonId;
      } else if (addon.addons && addon.addons.length > 0 && addon.addons[0].manifest) {
        manifest = addon.addons[0].manifest;
        addonName = manifest.name || `Addon at ${new URL(trimmedUrl).hostname}`;
        addonId = manifest.id || addonId;
      }
      
      const newAddonEntry = { id: addonId, url: trimmedUrl, name: addonName, manifest: manifest }; // Store manifest too
      const updatedAddons = [...addonUrls, newAddonEntry];
      setAddonUrls(updatedAddons);
      localStorage.setItem('stremioUserAddons', JSON.stringify(updatedAddons));
      setSuccessMessage(`Addon "${addonName}" added! Refreshing addon services...`);
      setAddonUrlInput('');
      refreshCinemeta(); // Call refresh here
    } catch (err) {
      setError(`Failed to add or detect addon. Error: ${err.message}. (Check URL, CORS)`);
      console.error("Error adding/detecting addon:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAddon = (addonIdToRemove) => {
    const updatedAddons = addonUrls.filter(addon => addon.id !== addonIdToRemove);
    setAddonUrls(updatedAddons);
    localStorage.setItem('stremioUserAddons', JSON.stringify(updatedAddons));
    setSuccessMessage('Addon removed.');
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
              placeholder="https://your-addon.com/manifest.json"
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
                <li key={addon.id} className="addon-item">
                  <div>
                    <span className="addon-name">{addon.name}</span>
                    <span className="addon-url-display">({addon.url})</span>
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
            <p><strong>Important:</strong> For addons to work directly in the browser, their servers must be configured to allow requests from this website (CORS headers like <code>Access-Control-Allow-Origin: *</code>). If an addon doesn't work, it's likely due to this restriction. In such cases, a backend proxy would be required.</p>
        </div>
      </main>
    </div>
  );
};

export default AddonSettings;