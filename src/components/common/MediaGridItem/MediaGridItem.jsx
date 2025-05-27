// src/components/common/MediaGridItem/MediaGridItem.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './MediaGridItem.css';

const MediaGridItem = ({ item }) => {
  if (!item) return null;

  const detailPath = `/${item.type || 'movie'}/${item.id}`;
  const title = item.name || item.title || 'Untitled';
  const year = item.year || 'N/A';
  const runtime = typeof item.runtime === 'number' ? `${item.runtime}m` : (item.runtime || 'N/A');
  const itemTypeDisplay = item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Media';

  return (
    <Link to={detailPath} className="media-grid-item-link-v3">
      <div className="media-grid-item-v3" title={title}>
        <div className="grid-item-poster-container-v3">
          <img
            src={item.poster || 'https://via.placeholder.com/300x450/12151B/FFFFFF?text=No+Poster'}
            alt={title}
            className="grid-item-poster-v3"
            loading="lazy"
          />
        </div>
        <div className="grid-item-text-content-v3">
          <h3 className="grid-item-title-v3">{title}</h3>
          <div className="grid-item-meta-line-v3">
            <div className="grid-item-details-v3">
              <span>{year}</span>
              {year !== 'N/A' && runtime !== 'N/A' && <span className="detail-separator-v3">•</span>}
              <span>{runtime}</span>
            </div>
            <div className="grid-item-type-badge-v3">
              {itemTypeDisplay}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MediaGridItem;