import React, { useState, useEffect, useCallback } from 'react';
import './AppearanceSettings.css';

const AppearanceSettings = () => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('appTheme') || 'dark'; // Default to dark
  });

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

  return (
    <div className="appearance-settings-content">
      <h2 className="settings-section-title">Appearance</h2>
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

      {/* Placeholder for Accent Color Picker */}
      <div className="setting-item-group">
        <h3 className="setting-item-group-title">Accent Color (Coming Soon)</h3>
        <div className="accent-color-options">
          <button className="accent-color-swatch active" style={{ backgroundColor: 'var(--accent-color-main)' }} title="Current Accent"></button>
          <button className="accent-color-swatch" style={{ backgroundColor: '#007bff' }} title="Blue"></button>
          <button className="accent-color-swatch" style={{ backgroundColor: '#28a745' }} title="Green"></button>
          <button className="accent-color-swatch" style={{ backgroundColor: '#dc3545' }} title="Red"></button>
          <button className="accent-color-swatch" style={{ backgroundColor: '#ffc107' }} title="Yellow"></button>
        </div>
        <p className="setting-description">Select a primary accent color for buttons and highlights.</p>
      </div>
    </div>
  );
};

export default AppearanceSettings;