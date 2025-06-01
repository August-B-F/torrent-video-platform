// src/components/pages/Home/ContinueWatchingCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './ContinueWatchingCard.css'; // Will use the new v3 styles

// Play icon - can be the same or updated if the new style demands
const PlayIconV3 = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"> {/* Slightly larger */}
    <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"></path>
  </svg>
);

const ContinueWatchingCard = ({ item }) => {
  if (!item || !item.id) {
    return null;
  }

  const detailPath = `/${item.type || 'movie'}/${item.id}`;
  const actualDuration = item.runtime ? parseFloat(item.runtime) * 60 : (item.mockDuration || 0); 
  const progressPercent = item.progress !== undefined && actualDuration > 0
    ? Math.max(0, Math.min(100, item.progress * 100))
    : 0;

  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds === Infinity || totalSeconds === null || totalSeconds <= 0) {
      return '';
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    if (minutes > 0) {
      return `${minutes}m left`;
    }
    return '<1m left';
  };

  const remainingTimeSeconds = actualDuration > 0 && item.progress !== undefined
                            ? actualDuration * (1 - item.progress)
                            : 0;
  const remainingTimeDisplay = formatTime(remainingTimeSeconds);
  
  const title = item.name || item.title || 'Untitled';
  const backgroundImage = item.background || item.poster || 'https://via.placeholder.com/800x450/101215/33363D?text=No+Scene';

  return (
    <Link to={detailPath} className="cw-card-v3-link-wrapper" title={title}>
      <div className="cw-card-v3">
        <div 
          className="cw-card-v3-background" 
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          {/* Play button centered */}
          <div className="cw-card-v3-play-overlay">
            <PlayIconV3 />
          </div>
        </div>
        
        <div className="cw-card-v3-info-bar">
          <div className="cw-card-v3-info-content">
            <div className="cw-v3-text-details">
              <h3 className="cw-v3-item-title">{title}</h3>
              {remainingTimeDisplay && <p className="cw-v3-item-remaining-time">{remainingTimeDisplay}</p>}
            </div>
          </div>
          {progressPercent > 0 && (
            <div className="cw-card-v3-progress-bar-container">
              <div 
                className="cw-card-v3-progress-bar" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ContinueWatchingCard;