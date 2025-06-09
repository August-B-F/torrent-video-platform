import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './FolderCard.css';

const FolderCard = ({ folder, getItemDetails, onClick, onContextMenu }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id, data: { type: 'folder-card', folder } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    cursor: 'grab',
  };

  const previewItems = folder.previewItemDetails || [];

  const handleCardClick = (e) => {
    if (isDragging || (e.target.closest('button') || e.target.closest('input'))) {
        return;
    }
    onClick(folder.id);
  };


  return (
    <div
      ref={setNodeRef}
      style={style}
      className="folder-card"
      onClick={handleCardClick}
      onContextMenu={(e) => onContextMenu(e, folder.id)}
      {...attributes} 
      {...listeners}  
    >
      <div className="folder-card-preview">
        {previewItems.length > 0 ? (
          previewItems.map((item, index) => (
            item && <img key={item.id || index} src={item.posterUrl} alt={item.title || ''} className="preview-poster" />
          ))
        ) : (
          <div className="empty-preview-placeholder">Folder is Empty</div>
        )}
        {Array.from({ length: Math.max(0, 4 - previewItems.length) }).map((_, i) => (
            <div key={`placeholder-${i}`} className="preview-poster placeholder"></div>
        ))}
      </div>
      <h3 className="folder-card-name">{folder.name} ({folder.items.length})</h3>
    </div>
  );
};

export default FolderCard;