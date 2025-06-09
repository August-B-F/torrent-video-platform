import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import './FolderContentView.css'; 

const SortableFolderItem = ({ id, itemData, onRemove, onMove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: 'folder-item', itemData } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} className="folder-content-grid-item-wrapper" {...attributes} {...listeners}>
      <MediaGridItem item={itemData.details} />
    </div>
  );
};


const FolderContentView = ({ folder, itemsWithDetails, onBack, onReorderItems, onRemoveItem, onMoveItem }) => {
  const [activeDragItem, setActiveDragItem] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event) {
    const { active } = event;
    const draggedItemData = itemsWithDetails.find(i => i.id === active.id);
    setActiveDragItem({ ...active, data: { ...active.data.current, itemData: draggedItemData } });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveDragItem(null);

    if (over && active.id !== over.id) {
      const oldIndex = itemsWithDetails.findIndex(item => item.id === active.id);
      const newIndex = itemsWithDetails.findIndex(item => item.id === over.id);
      onReorderItems(folder.id, arrayMove(itemsWithDetails.map(i => i.id), oldIndex, newIndex));
    }
  }

  return (
    <div className="folder-content-view">
      <div className="folder-content-header">
        <button onClick={onBack} className="back-to-folders-btn">&larr; All Folders</button>
        <h1 className="page-title folder-view-title">{folder.name}</h1>
        <span>({itemsWithDetails.length} items)</span>
      </div>

      {itemsWithDetails.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemsWithDetails.map(i => i.id)} strategy={rectSortingStrategy}>
            <div className="media-grid folder-items-grid">
              {itemsWithDetails.map(itemData => (
                <SortableFolderItem
                  key={itemData.id}
                  id={itemData.id}
                  itemData={itemData}
                  onRemove={() => onRemoveItem(folder.id, itemData.id)}
                  onMove={() => onMoveItem(folder.id, itemData.id)} 
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeDragItem && activeDragItem.data?.itemData?.details ? (
              <div className="drag-overlay-item"> 
                <MediaGridItem item={activeDragItem.data.itemData.details} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <p className="empty-message">This folder is empty. Add some movies or series!</p>
      )}
    </div>
  );
};

export default FolderContentView;