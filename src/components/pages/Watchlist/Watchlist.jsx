// src/components/pages/Watchlist/Watchlist.jsx
import React, { useState, useEffect, useCallback }  from 'react'; // Removed useRef as it wasn't used here directly for contextMenu
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

import { useWatchlist, FOLDER_ICON_OPTIONS } from '../../contexts/WatchlistContext';
import { usePopup } from '../../contexts/PopupContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import CreateFolderModal from './CreateFolderModal';
import ContextMenu from '../../common/ContextMenu/ContextMenu';
import './WatchlistStyle.css';
import './FolderCard.css';
import './FolderContentView.css';

// --- SVG Icons --- (Assuming these are defined as before)
const MovieIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"></path></svg>;
const SeriesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM7 15h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"></path></svg>;
const DefaultFolderIconSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M0 0h24v24H0z" fill="none"/>
        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
);
// --- End Icons ---

const renderFolderListCardIcon = (iconType, iconValue) => {
    if (iconType === FOLDER_ICON_OPTIONS.IMAGE_URL && iconValue) {
      return <img src={iconValue} alt="" className="folder-display-custom-icon" />;
    }
    if (iconType === FOLDER_ICON_OPTIONS.EMOJI && iconValue) {
      return <span className="folder-display-emoji-icon">{iconValue}</span>;
    }
    switch(iconType) {
        case FOLDER_ICON_OPTIONS.MOVIE: return <MovieIcon />;
        case FOLDER_ICON_OPTIONS.SERIES: return <SeriesIcon />;
        case FOLDER_ICON_OPTIONS.DEFAULT:
        default:
            return <DefaultFolderIconSvg />;
    }
};

const FolderCardInternal = ({ folder, onClick, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: folder.id, data: { type: 'folder-card', folder } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    cursor: isDragging ? 'grabbing': 'grab',
    touchAction: 'none'
  };

  const handleCardClick = (e) => {
    if (e.target.closest('button') || isDragging) return;
    onClick(folder.id);
  };

  const handleCardContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, folder.id, null); // Pass null for itemId for folder context menu
  };

  return (
    <div ref={setNodeRef} style={style} className="folder-card" onClick={handleCardClick} onContextMenu={handleCardContextMenu} {...attributes} {...listeners}>
      <div className="folder-card-icon-container" style={{ backgroundColor: folder.color || 'var(--bg-secondary)' }}>
        {renderFolderListCardIcon(folder.iconType, folder.iconValue)}
      </div>
      <div className="folder-card-info">
        <h3 className="folder-card-name" title={folder.name}>{folder.name}</h3>
        <span className="folder-card-item-count">{folder.items.length} item{folder.items.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};

const SortableFolderItemInternal = ({ id, itemData, onRemoveItem, onItemContextMenu }) => { // Added onItemContextMenu
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: 'folder-item', itemData } });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none'
    };

    if (!itemData || !itemData.details) {
      return <div ref={setNodeRef} style={style} className="folder-content-grid-item-wrapper missing-item">Item data unavailable</div>;
    }

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onItemContextMenu(e, itemData.id); // Call the passed handler
    };

    return (
        <div ref={setNodeRef} style={style} className="folder-content-grid-item-wrapper" {...attributes} {...listeners} onContextMenu={handleContextMenu}>
            <MediaGridItem item={itemData.details} />
            <button
                className="item-action-btn remove-item"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(itemData.id);
                }}
                title="Remove from this list"
            >
                 &times;
            </button>
        </div>
    );
};


const FolderContentViewInternal = ({ folder, itemsWithDetails, onBack, onReorderItems, onRemoveItemFromFolder, isLoadingItems, onItemContextMenuInFolder }) => {
    const [activeDragItem, setActiveDragItem] = useState(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    function handleDragStart(event) {
        const { active } = event;
        const draggedItemData = itemsWithDetails.find(i => i.id === active.id);
        setActiveDragItem({ ...active, data: { ...active.data?.current, itemData: draggedItemData } });
    }

    function handleDragEnd(event) {
        const { active, over } = event;
        setActiveDragItem(null);
        if (over && active.id !== over.id) {
            const oldIndex = itemsWithDetails.findIndex(item => item.id === active.id);
            const newIndex = itemsWithDetails.findIndex(item => item.id === over.id);
            const reorderedItems = arrayMove(itemsWithDetails, oldIndex, newIndex);
            onReorderItems(folder.id, reorderedItems);
        }
    }

    if (!folder) {
      return (
          <div className="page-container watchlist-page">
               <main className="page-main-content">
                  <div className="empty-message" style={{paddingTop: "50px"}}>
                      List not found. It might have been deleted.
                      <button onClick={onBack} className="back-to-folders-btn" style={{marginTop: "20px", display: "block", marginLeft: "auto", marginRight: "auto"}}>
                          &larr; Back to My Lists
                      </button>
                  </div>
              </main>
          </div>
      );
  }

    return (
        <div className="folder-content-view">
            <div className="folder-content-header">
                <button onClick={onBack} className="back-to-folders-btn">&larr; All Lists</button>
                <h1 className="page-title folder-view-title">{folder.name}</h1>
                <span>({itemsWithDetails.length} items)</span>
            </div>
            {isLoadingItems && <div className="loading-message">Loading items...</div>}
            {!isLoadingItems && itemsWithDetails.length === 0 && (<p className="empty-message">This list is empty. Add some movies or series!</p>)}
            {!isLoadingItems && itemsWithDetails.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} >
                <SortableContext items={itemsWithDetails.map(i => i.id)} strategy={rectSortingStrategy}>
                    <div className="media-grid folder-items-grid">
                    {itemsWithDetails.map(itemData => (
                        <SortableFolderItemInternal
                            key={itemData.id}
                            id={itemData.id}
                            itemData={itemData}
                            onRemoveItem={() => onRemoveItemFromFolder(folder.id, itemData.id)}
                            onItemContextMenu={(e, itemId) => onItemContextMenuInFolder(e, itemId, folder.id)} // Pass folder.id
                        />
                    ))}
                    </div>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                    {activeDragItem && activeDragItem.data?.itemData?.details ? (
                    <div className="drag-overlay-item">
                        <MediaGridItem item={activeDragItem.data.itemData.details} />
                    </div>
                    ) : null}
                </DragOverlay>
                </DndContext>
            )}
        </div>
    );
};

const Watchlist = () => {
  const {
    folders, isLoadingFolders: isLoadingContextFolders, addFolder, renameFolder, deleteFolder,
    removeItemFromFolder, reorderItemsInFolder, reorderFolders,
    fetchItemDetails
  } = useWatchlist();
  const { showPopup } = usePopup();

  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // Unified context menu state
  const [contextMenuState, setContextMenuState] = useState({
    visible: false, x: 0, y: 0, targetId: null, targetType: null // type can be 'folder' or 'item'
  });


  const [activeDragItem, setActiveDragItem] = useState(null);
  const [isLoadingFolderItemsDetails, setIsLoadingFolderItemsDetails] = useState(false);
  const [currentFolderItemsWithDetails, setCurrentFolderItemsWithDetails] = useState([]);

  useEffect(() => {
    const selectedFolderData = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;
    if (selectedFolderData) {
      setIsLoadingFolderItemsDetails(true);
      const fetchAllDetailsForView = async () => {
        try {
          const detailedItems = await Promise.all(
            selectedFolderData.items.map(async (itemObj) => {
              const detail = await fetchItemDetails(itemObj.id, itemObj.type);
              return {
                  id: itemObj.id,
                  type: itemObj.type,
                  details: detail || { name: `Item ${itemObj.id}`, posterUrl: '', id: itemObj.id, type: itemObj.type }
              };
            })
          );
          setCurrentFolderItemsWithDetails(detailedItems);
        } catch (error) {
            console.error("Error fetching details for folder items view:", error);
            showPopup("Error loading items for this list.", "warning");
        } finally {
            setIsLoadingFolderItemsDetails(false);
        }
      };
      fetchAllDetailsForView();
    } else {
      setCurrentFolderItemsWithDetails([]);
    }
  }, [selectedFolderId, folders, fetchItemDetails, showPopup]);

  const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleCreateFolderSubmit = (name) => {
    addFolder(name);
  };

  const startRenameFolder = (folderId) => {
    closeContextMenu();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) {
        showPopup("Could not find the list to rename.", "warning");
        return;
    }
    const newName = prompt("Enter new folder name:", folder.name);
    if (newName && newName.trim() !== "" && newName.trim() !== folder.name) {
      renameFolder(folderId, newName.trim());
    }
  };

  const confirmDeleteFolder = (folderId) => {
    closeContextMenu();
    if (deleteFolder(folderId)) {
        if (selectedFolderId === folderId) setSelectedFolderId(null);
    }
  };

  const handleFolderDragStart = (event) => {
    const { active } = event;
    const folderData = folders.find(f => f.id === active.id);
    setActiveDragItem({ id: active.id, type: 'folder-card', data: folderData });
  };

  const handleFolderDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (over && active.id !== over.id && active.data.current?.type === 'folder-card' && over.data.current?.type === 'folder-card') {
      const oldIndex = folders.findIndex(item => item.id === active.id);
      const newIndex = folders.findIndex(item => item.id === over.id);
      reorderFolders(arrayMove(folders, oldIndex, newIndex));
    }
  };

  const handleViewFolderContents = (folderId) => {
    setSelectedFolderId(folderId);
    closeContextMenu();
  };

  const handleContextMenu = (event, targetId, targetType) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuState({ visible: true, x: event.clientX, y: event.clientY, targetId, targetType });
  };

  const closeContextMenu = useCallback(() => {
    setContextMenuState(prev => ({ ...prev, visible: false, targetId: null, targetType: null }));
  }, []);

  const getContextMenuOptions = () => {
    if (!contextMenuState.visible || !contextMenuState.targetId) return [];

    if (contextMenuState.targetType === 'folder') {
      return [
        { label: 'View Items', action: () => handleViewFolderContents(contextMenuState.targetId) },
        { label: 'Rename List', action: () => startRenameFolder(contextMenuState.targetId) },
        { label: 'Delete List', action: () => confirmDeleteFolder(contextMenuState.targetId) },
      ];
    } else if (contextMenuState.targetType === 'item') {
        // targetId here is itemId, and we need the current folderId for removal
        const currentFolderForContext = selectedFolderId; // This should be set if we are in folder view
        if (!currentFolderForContext) return [];
      return [
        { label: 'Remove from this List', action: () => {
            removeItemFromFolder(currentFolderForContext, contextMenuState.targetId);
            closeContextMenu();
          }
        },
        // { label: 'Move to another List...', action: () => { /* TODO: Implement move modal */ closeContextMenu(); } },
      ];
    }
    return [];
  };


  const selectedFolderDataForView = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;

  if (isLoadingContextFolders && folders.length === 0 && !selectedFolderId) {
    return <div className="page-container watchlist-page"><div className="loading-message">Loading Your Lists...</div></div>;
  }

  return (
    <div className="page-container watchlist-page">
      <main className="page-main-content">
        {!selectedFolderId ? (
          <>
            <div className="watchlist-header">
              <h1 className="page-title">My Lists</h1>
              <button onClick={() => setIsCreateModalOpen(true)} className="create-folder-btn">
                + New List
              </button>
            </div>
            {folders.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleFolderDragStart} onDragEnd={handleFolderDragEnd}>
                <SortableContext items={folders.map(f => f.id)} strategy={rectSortingStrategy}>
                  <div className="folder-grid">
                    {folders.map(folder => (
                      <FolderCardInternal
                        key={folder.id}
                        folder={folder}
                        onClick={handleViewFolderContents}
                        onContextMenu={(e, folderId) => handleContextMenu(e, folderId, 'folder')}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {activeDragItem && activeDragItem.type === 'folder-card' && activeDragItem.data ? (
                    <div className="folder-card drag-overlay-folder-card-active" style={{ backgroundColor: activeDragItem.data.color || 'var(--bg-secondary)' }}>
                        <div className="folder-card-icon-container" style={{ backgroundColor: activeDragItem.data.color || 'var(--bg-secondary)'}}>
                             {renderFolderListCardIcon(activeDragItem.data.iconType, activeDragItem.data.iconValue)}
                        </div>
                        <div className="folder-card-info">
                            <h3 className="folder-card-name">{activeDragItem.data.name}</h3>
                             <span className="folder-card-item-count">
                                {activeDragItem.data.items.length} item{activeDragItem.data.items.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : !isLoadingContextFolders ? (
              <div className="empty-watchlist-container">
                <svg className="empty-watchlist-icon" viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 8H14c-2.21 0-4 1.79-4 4v36c0 2.21 1.79 4 4 4h36c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zm-2 38H16V14h32v32z"/><path d="M24 22h16v2H24zM24 28h16v2H24zM24 34h10v2H24z"/></svg>
                <h2>Your Lists are Empty</h2>
                <p>Create lists to organize movies and series you want to watch.</p>
                <button onClick={() => setIsCreateModalOpen(true)} className="create-folder-btn large">
                  + Create Your First List
                </button>
              </div>
            ) : null
            }
          </>
        ) : selectedFolderDataForView ? (
          <FolderContentViewInternal
            folder={selectedFolderDataForView}
            itemsWithDetails={currentFolderItemsWithDetails}
            onBack={() => setSelectedFolderId(null)}
            onReorderItems={reorderItemsInFolder}
            onRemoveItemFromFolder={removeItemFromFolder} // This is passed to FolderContentViewInternal
            isLoadingItems={isLoadingFolderItemsDetails}
            onItemContextMenuInFolder={(e, itemId) => handleContextMenu(e, itemId, 'item')} // New prop for item context menu
          />
        ) : (
          <div className="page-container watchlist-page">
            <main className="page-main-content">
                <div className="empty-message" style={{paddingTop: "50px"}}>
                    Selected list not found or has been deleted.
                    <button onClick={() => setSelectedFolderId(null)} className="back-to-folders-btn" style={{marginTop: "20px", display: "block", marginLeft: "auto", marginRight: "auto"}}>
                        &larr; Back to My Lists
                    </button>
                </div>
            </main>
          </div>
        )}
      </main>
      <CreateFolderModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreateFolder={handleCreateFolderSubmit} />
      {contextMenuState.visible && <ContextMenu x={contextMenuState.x} y={contextMenuState.y} options={getContextMenuOptions()} onClose={closeContextMenu} />}
    </div>
  );
};

export default Watchlist;