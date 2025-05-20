// src/components/pages/AppearanceSettings/AppearanceSettings.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useWatchlist, FOLDER_ICON_OPTIONS } from '../../contexts/WatchlistContext';
import './AppearanceSettings.css';

// --- SVG Icons --- (These should ideally be in a shared icons file)
const MovieIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"></path></svg>;
const SeriesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM7 15h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"></path></svg>;
const DefaultFolderIconSvg = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M0 0h24v24H0z" fill="none"/><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>;
const ImageIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6l2.78-3.71c.39-.52 1.03-.52 1.42 0L13 14h2l2.78-3.71c.39-.52 1.03-.52 1.42 0L18 14z"/></svg>;
const EmojiIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5s.67 1.5 1.5 1.5zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"></path></svg>;
// --- End Icons ---

const AppearanceSettings = () => {
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('appTheme') || 'dark');
  const [currentAccent, setCurrentAccent] = useState(() => localStorage.getItem('appAccentColor') || '#6A5AF9');

  const { folders, updateFolderAppearance } = useWatchlist();

  const applyTheme = useCallback((theme) => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('appTheme', theme);
  }, []);

  const applyAccentColor = useCallback((color) => {
    document.documentElement.style.setProperty('--accent-color-main', color);
    // Basic derivation for hover/soft variants. More sophisticated logic might be needed for perfect shades.
    // This is a simplistic approach; proper color manipulation libraries could be used.
    try {
        let r = parseInt(color.slice(1, 3), 16);
        let g = parseInt(color.slice(3, 5), 16);
        let b = parseInt(color.slice(5, 7), 16);

        document.documentElement.style.setProperty('--accent-rgb', `${r},${g},${b}`);
        
        // Darken for hover (rough approximation)
        const hoverR = Math.max(0, r - 20);
        const hoverG = Math.max(0, g - 20);
        const hoverB = Math.max(0, b - 20);
        document.documentElement.style.setProperty('--accent-color-hover', `rgb(${hoverR},${hoverG},${hoverB})`);

        // Lighten for soft (rough approximation)
        const softR = Math.min(255, r + 20);
        const softG = Math.min(255, g + 20);
        const softB = Math.min(255, b + 20);
        document.documentElement.style.setProperty('--accent-color-soft', `rgb(${softR},${softG},${softB})`);

    } catch (e) {
        console.error("Error deriving accent color variants:", e);
        // Fallback if color parsing fails
        document.documentElement.style.setProperty('--accent-rgb', '106,90,249');
        document.documentElement.style.setProperty('--accent-color-hover', '#5848e3');
        document.documentElement.style.setProperty('--accent-color-soft', '#887dfa');
    }
    localStorage.setItem('appAccentColor', color);
  }, []);


  useEffect(() => {
    applyTheme(currentTheme);
    applyAccentColor(currentAccent);
  }, [currentTheme, currentAccent, applyTheme, applyAccentColor]);

  const handleThemeChange = (event) => setCurrentTheme(event.target.value);
  const handleAccentChange = (color) => setCurrentAccent(color);

  const handleFolderIconChange = (folderId, newIconValue) => {
    let iconType = FOLDER_ICON_OPTIONS.DEFAULT; // Default
    let finalIconValue = newIconValue.trim();

    if (finalIconValue.startsWith('http://') || finalIconValue.startsWith('https://') || finalIconValue.startsWith('data:image/')) {
      iconType = FOLDER_ICON_OPTIONS.IMAGE_URL;
    } else if (finalIconValue.length > 0 && finalIconValue.length <= 2 && /\p{Emoji}/u.test(finalIconValue)) { // Basic emoji check (1-2 chars)
      iconType = FOLDER_ICON_OPTIONS.EMOJI;
    } else if (Object.values(FOLDER_ICON_OPTIONS).includes(finalIconValue)) { // Check if it's a keyword
      iconType = finalIconValue;
      finalIconValue = null; // Keyword itself is the type, no separate value needed
    } else if (finalIconValue === '') { // If cleared, revert to default
        iconType = FOLDER_ICON_OPTIONS.DEFAULT;
        finalIconValue = null;
    }
    // If it's not a URL, emoji, or known keyword, it might be treated as a custom text/emoji by renderFolderIcon later
    // or we could decide to only allow specific types. For now, if it's not a URL or known keyword, treat as EMOJI for display.
    else if (finalIconValue && !iconType) { // If not a URL or keyword, assume emoji/text
        iconType = FOLDER_ICON_OPTIONS.EMOJI;
    }


    updateFolderAppearance(folderId, { iconType, iconValue: finalIconValue });
  };

  const handleFolderColorChange = (folderId, newColor) => {
    updateFolderAppearance(folderId, { color: newColor });
  };
  
  const renderFolderIconDisplay = (iconType, iconValue, folderColor) => {
    const style = { backgroundColor: folderColor || '#333' };
    switch(iconType) {
        case FOLDER_ICON_OPTIONS.MOVIE: return <div className="icon-preview" style={style}><MovieIcon /></div>;
        case FOLDER_ICON_OPTIONS.SERIES: return <div className="icon-preview" style={style}><SeriesIcon /></div>;
        case FOLDER_ICON_OPTIONS.IMAGE_URL: return <img src={iconValue} alt="folder icon" className="icon-preview custom-image-icon" />;
        case FOLDER_ICON_OPTIONS.EMOJI: return <div className="icon-preview emoji-icon-preview" style={style}>{iconValue}</div>;
        case FOLDER_ICON_OPTIONS.DEFAULT:
        default:
            return <div className="icon-preview" style={style}><DefaultFolderIconSvg /></div>;
    }
  };

  const accentColorPalette = [
    { name: 'Default Purple', color: '#6A5AF9' },
    { name: 'Ocean Blue', color: '#007BFF' },
    { name: 'Crimson Red', color: '#DC3545' },
    { name: 'Forest Green', color: '#28A745' },
    { name: 'Goldenrod Yellow', color: '#FFC107' },
    { name: 'Teal', color: '#17A2B8'},
    { name: 'Charcoal Gray', color: '#343A40'}
  ];


  return (
    <div className="appearance-settings-content">
      <h2 className="settings-section-title main-settings-title">Application Appearance</h2>
      <p className="settings-section-description">Customize the look and feel of your application.</p>

      <div className="setting-item-group">
        <h3 className="setting-item-group-title">Theme</h3>
        <div className="theme-options">
          <label className={`theme-option ${currentTheme === 'light' ? 'selected' : ''}`}>
            <input type="radio" name="theme" value="light" checked={currentTheme === 'light'} onChange={handleThemeChange}/>
            <div className="theme-preview light-preview"><div className="preview-header"></div><div className="preview-content">Aa</div></div>
            Light
          </label>
          <label className={`theme-option ${currentTheme === 'dark' ? 'selected' : ''}`}>
            <input type="radio" name="theme" value="dark" checked={currentTheme === 'dark'} onChange={handleThemeChange}/>
            <div className="theme-preview dark-preview"><div className="preview-header"></div><div className="preview-content">Aa</div></div>
            Dark
          </label>
        </div>
      </div>
      
      <div className="setting-item-group">
        <h3 className="setting-item-group-title">Accent Color</h3>
        <div className="accent-color-options">
          {accentColorPalette.map(accent => (
            <button 
              key={accent.color} 
              className={`accent-color-swatch ${currentAccent === accent.color ? 'active' : ''}`} 
              style={{ backgroundColor: accent.color }} 
              title={accent.name}
              onClick={() => handleAccentChange(accent.color)}
              aria-label={`Set accent color to ${accent.name}`}
            />
          ))}
        </div>
         <input 
            type="color" 
            value={currentAccent} 
            onChange={(e) => handleAccentChange(e.target.value)} 
            className="custom-accent-color-picker"
            title="Custom Accent Color"
        />
      </div>

      <div className="setting-item-group">
        <h3 className="setting-item-group-title">List Appearance</h3>
        {folders.map(folder => (
          <div key={folder.id} className="folder-appearance-setting">
            <span className="folder-name-label" title={folder.name}>{folder.name}</span>
            <div className="folder-controls">
              <div className="control-group icon-control-group">
                <label htmlFor={`icon-input-${folder.id}`} className="icon-input-label">Icon:</label>
                <div className="icon-input-wrapper">
                  <input
                      type="text"
                      id={`icon-input-${folder.id}`}
                      value={folder.iconType === FOLDER_ICON_OPTIONS.DEFAULT || folder.iconType === FOLDER_ICON_OPTIONS.MOVIE || folder.iconType === FOLDER_ICON_OPTIONS.SERIES ? folder.iconType : folder.iconValue || ''}
                      onChange={(e) => handleFolderIconChange(folder.id, e.target.value)}
                      placeholder="URL, emoji, or keyword"
                      className="folder-icon-input"
                  />
                   <select 
                      id={`icon-preset-${folder.id}`}
                      value={folder.iconType === FOLDER_ICON_OPTIONS.DEFAULT || folder.iconType === FOLDER_ICON_OPTIONS.MOVIE || folder.iconType === FOLDER_ICON_OPTIONS.SERIES ? folder.iconType : 'custom'}
                      onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'custom') {
                              // If they select custom, ideally focus the text input or prompt.
                              // For now, it just means the text input value will be used.
                              // If they type a URL/emoji, it will be picked up by handleFolderIconChange.
                              // If they clear the text input after selecting a preset, it should revert to default.
                              const currentInputValue = folders.find(f=>f.id === folder.id)?.iconValue || '';
                              handleFolderIconChange(folder.id, currentInputValue);
                          } else {
                              handleFolderIconChange(folder.id, val); // Pass the keyword directly
                          }
                      }}
                      className="folder-icon-preset-select"
                    >
                        <option value="custom">Custom/URL/Emoji</option>
                        <option value={FOLDER_ICON_OPTIONS.DEFAULT}>Default (Folder)</option>
                        <option value={FOLDER_ICON_OPTIONS.MOVIE}>Movie Icon</option>
                        <option value={FOLDER_ICON_OPTIONS.SERIES}>Series Icon</option>
                        {/* Add more predefined icon options here if any */}
                    </select>
                </div>
                 {renderFolderIconDisplay(folder.iconType, folder.iconValue, folder.color)}
              </div>
              <div className="control-group color-control-group">
                <label htmlFor={`color-${folder.id}`} className="color-picker-label">Color:</label>
                <input
                  type="color"
                  id={`color-${folder.id}`}
                  value={folder.color || '#2E3039'}
                  onChange={(e) => handleFolderColorChange(folder.id, e.target.value)}
                  className="folder-appearance-color-picker"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppearanceSettings;