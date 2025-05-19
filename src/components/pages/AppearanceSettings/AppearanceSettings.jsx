import React, { useState, useEffect, useCallback } from 'react';
import { useWatchlist, FOLDER_ICON_OPTIONS } from '../../contexts/WatchlistContext'; // Import FOLDER_ICON_OPTIONS
import './AppearanceSettings.css';

// Simple SVG Icons (can be expanded or loaded dynamically)
const MovieIcon = () => <svg viewBox="0 0 24 24"><path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"></path></svg>;
const SeriesIcon = () => <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM7 15h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"></path></svg>;
const DefaultFolderIconSvg = () => <svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>;


const AppearanceSettings = () => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('appTheme') || 'dark'; 
  });

  const { folders, updateFolderAppearance } = useWatchlist();

  const applyTheme = useCallback((theme) => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('appTheme', theme);
  }, []);

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme, applyTheme]);

  const handleThemeChange = (event) => {
    setCurrentTheme(event.target.value);
  };

  const handleFolderIconChange = (folderId, newIcon) => {
    updateFolderAppearance(folderId, { icon: newIcon });
  };

  const handleFolderColorChange = (folderId, newColor) => {
    updateFolderAppearance(folderId, { color: newColor });
  };
  
  const renderFolderIcon = (iconKey) => {
    switch(iconKey) {
        case FOLDER_ICON_OPTIONS.MOVIE: return <MovieIcon />;
        case FOLDER_ICON_OPTIONS.SERIES: return <SeriesIcon />;
        // Add more cases for other predefined icons
        case FOLDER_ICON_OPTIONS.DEFAULT:
        default:
            return <DefaultFolderIconSvg />; // Default SVG
    }
  };

  return (
    <div className="appearance-settings-content">
      <h2 className="settings-section-title">Application Appearance</h2>
      <p className="settings-section-description">Customize the look and feel of your application.</p>

      <div className="setting-item-group">
        <h3 className="setting-item-group-title">Application Theme</h3>
        <div className="theme-options">
          <label className={`theme-option ${currentTheme === 'light' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={currentTheme === 'light'}
              onChange={handleThemeChange}
            />
            <div className="theme-preview light-preview">
              <div className="preview-header"></div>
              <div className="preview-content">Aa</div>
            </div>
            Light
          </label>
          <label className={`theme-option ${currentTheme === 'dark' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={currentTheme === 'dark'}
              onChange={handleThemeChange}
            />
            <div className="theme-preview dark-preview">
              <div className="preview-header"></div>
              <div className="preview-content">Aa</div>
            </div>
            Dark
          </label>
        </div>
      </div>
      
      <div className="setting-item-group">
        <h3 className="setting-item-group-title">List Appearance</h3>
        {folders.map(folder => (
          <div key={folder.id} className="folder-appearance-setting">
            <span className="folder-name-label">{folder.name}</span>
            <div className="folder-controls">
              <div className="control-group">
                <label htmlFor={`icon-${folder.id}`}>Icon:</label>
                {/* Simple text input for icon for now (e.g., emoji or keyword) */}
                {/* For keywords, you'd map them to SVGs in FolderCardInternal */}
                <select 
                    id={`icon-${folder.id}`}
                    value={folder.icon || FOLDER_ICON_OPTIONS.DEFAULT}
                    onChange={(e) => handleFolderIconChange(folder.id, e.target.value)}
                    className="folder-appearance-select"
                >
                    <option value={FOLDER_ICON_OPTIONS.DEFAULT}>Default (Folder)</option>
                    <option value={FOLDER_ICON_OPTIONS.MOVIE}>Movie Icon</option>
                    <option value={FOLDER_ICON_OPTIONS.SERIES}>Series Icon</option>
                    {/* Add more predefined icon options here */}
                    {/* Or allow text input for emojis: <input type="text" value={folder.icon} onChange={(e) => handleFolderIconChange(folder.id, e.target.value)} /> */}
                </select>
                 <div className="icon-preview" style={{ backgroundColor: folder.color || '#333' }}>
                    {renderFolderIcon(folder.icon)}
                </div>
              </div>
              <div className="control-group">
                <label htmlFor={`color-${folder.id}`}>Color:</label>
                <input
                  type="color"
                  id={`color-${folder.id}`}
                  value={folder.color || '#2E3039'} // Provide a default if undefined
                  onChange={(e) => handleFolderColorChange(folder.id, e.target.value)}
                  className="folder-appearance-color-picker"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder for Accent Color Picker */}
      <div className="setting-item-group">
        <h3 className="setting-item-group-title">Accent Color (Global - Coming Soon)</h3>
        <div className="accent-color-options">
          <button className="accent-color-swatch active" style={{ backgroundColor: 'var(--accent-color-main)' }} title="Current Accent"></button>
          {/* More swatches... */}
        </div>
        <p className="setting-description">Select a primary accent color for buttons and highlights.</p>
      </div>
    </div>
  );
};

export default AppearanceSettings;