// src/components/common/MediaGridItem/MediaGridItem.jsx
import React from 'react';
import { Link } from 'react-router-dom'; // Import Link
import './MediaGridItem.css';

const MediaGridItem = ({ item }) => {
  if (!item) return null;
  // Determine the path: type is 'movie' or 'series', id is usually imdb_id
  const detailPath = `/${item.type || 'movie'}/${item.id}`; // Default to movie if type unknown

  return (
    <Link to={detailPath} className="media-grid-item-link"> {/* Wrap with Link */}
      <div className="media-grid-item" title={item.name || item.title}>
        <img src={item.poster || 'https://via.placeholder.com/300x450?text=No+Poster'} alt={item.name || item.title} className="grid-item-poster" loading="lazy" />
      </div>
    </Link>
  );
};

export default MediaGridItem;