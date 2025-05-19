import React, { useState, useEffect, useCallback, useRef }  from 'react';
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

import { useWatchlist } from '../../contexts/WatchlistContext';
import { usePopup } from '../../contexts/PopupContext';
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import CreateFolderModal from './CreateFolderModal';
import ContextMenu from '../../common/ContextMenu/ContextMenu';
import './WatchlistStyle.css';
import './FolderContentView.css'; // Ensure this CSS file exists and is styled

// Default Folder Icon (SVG)
const DefaultFolderIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 0h24v24H0z" fill="none"/>
        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
);

// --- Sortable Folder Card Component ---
const FolderCardInternal = ({ folder, onClick, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = 
    useSortable({ id: folder.id, data: { type: 'folder-card', folder } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    cursor: isDragging ? 'grabbing': 'grab',
    touchAction: 'none' // Important for pointer sensor interactions
  };

  // onClick handler for the main div
  const handleCardClick = (e) => {
    // Prevent click if a button inside card (if any future buttons are added) was clicked or if dragging
    if (e.target.closest('button') || isDragging) {
      // console.log("FolderCard click prevented (isDragging or button click)");
      return;
    }
    // console.log(`FolderCard clicked: ${folder.id}`);
    onClick(folder.id);
  };
  
  const handleCardContextMenu = (e) => {
    e.preventDefault(); // Prevent native context menu
    e.stopPropagation(); // Stop event from bubbling up and closing immediately
    // console.log(`FolderCard context menu: ${folder.id} at (${e.clientX}, ${e.clientY})`);
    onContextMenu(e, folder.id);
  };


  return (
    <div
        ref={setNodeRef}
        style={style}
        className="folder-card"
        onClick={handleCardClick}
        onContextMenu={handleCardContextMenu}
        {...attributes} // For dnd-kit sortable functionality
        {...listeners}  // For dnd-kit drag handle
    >
      <div className="folder-card-icon-container">
        {/* Customizable icon can be added here later based on folder properties */}
        <DefaultFolderIcon />
      </div>
      <div className="folder-card-info">
        <h3 className="folder-card-name">{folder.name}</h3>
        {/* Item count removed as per request, can be added back with .folder-card-item-count style */}
        {/* <span className="folder-card-item-count">{folder.items.length} items</span> */}
      </div>
    </div>
  );
};

// --- Sortable Item for Folder Content View (No changes needed from previous version) ---
const SortableFolderItemInternal = ({ id, itemData, onRemoveItem }) => {
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

    return (
        <div ref={setNodeRef} style={style} className="folder-content-grid-item-wrapper" {...attributes} {...listeners}>
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


// --- Folder Content View Component (No changes needed from previous version, assuming it works) ---
const FolderContentViewInternal = ({ folder, itemsWithDetails, onBack, onReorderItems, onRemoveItemFromFolder, isLoadingItems }) => {
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

    if (!folder) { // Guard clause if folder is somehow null/undefined
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


// --- Main Watchlist Component ---
const Watchlist = () => {
  const {
    folders, isLoadingFolders: isLoadingContextFolders, addFolder, renameFolder, deleteFolder,
    removeItemFromFolder, reorderItemsInFolder, reorderFolders,
    itemDetailsCache, fetchItemDetails // We don't need itemDetailsCache or fetchItemDetails for folder card previews now
  } = useWatchlist();
  const { showPopup } = usePopup();

  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, folderId: null });
  
  const [activeDragItem, setActiveDragItem] = useState(null); // For folder card dragging
  const [isLoadingFolderItemsDetails, setIsLoadingFolderItemsDetails] = useState(false);
  const [currentFolderItemsWithDetails, setCurrentFolderItemsWithDetails] = useState([]);
  // No need for foldersWithPreviewsState if we are not showing image previews on the card itself

  // Fetch full details for items in the currently selected folder
  useEffect(() => {
    const selectedFolderData = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;
    if (selectedFolderData) {
      setIsLoadingFolderItemsDetails(true);
      const fetchAllDetailsForView = async () => {
        try {
          const detailedItems = await Promise.all(
            selectedFolderData.items.map(async (itemObj) => {
              // Use fetchItemDetails from context for consistency and caching
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
  }, [selectedFolderId, folders, fetchItemDetails, showPopup]); // itemDetailsCache removed as fetchItemDetails handles it

  const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), // Allows a small tolerance before drag starts
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleCreateFolderSubmit = (name) => {
    addFolder(name); // Popup is handled in context
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
      renameFolder(folderId, newName.trim()); // Popup is handled in context
    }
  };

  const confirmDeleteFolder = (folderId) => {
    closeContextMenu(); 
    if (deleteFolder(folderId)) { // Popup is handled in context
        if (selectedFolderId === folderId) setSelectedFolderId(null); 
    }
  };

  const handleFolderDragStart = (event) => {
    const { active } = event;
    // We use `folders` directly now as `foldersWithPreviewsState` is removed
    const folderData = folders.find(f => f.id === active.id);
    setActiveDragItem({ id: active.id, type: 'folder-card', data: folderData });
  };

  const handleFolderDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (over && active.id !== over.id && active.data.current?.type === 'folder-card' && over.data.current?.type === 'folder-card') {
      const oldIndex = folders.findIndex(item => item.id === active.id);
      const newIndex = folders.findIndex(item => item.id === over.id);
      reorderFolders(arrayMove(folders, oldIndex, newIndex)); // Pass the main folders array
    }
  };
  
  const handleViewFolderContents = (folderId) => {
    // console.log("Attempting to view folder:", folderId);
    setSelectedFolderId(folderId);
    closeContextMenu(); 
  };

  const handleRightClickFolder = (event, folderId) => {
    event.preventDefault();
    event.stopPropagation();
    // console.log("Right click on folder:", folderId, "at", event.clientX, event.clientY);
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, folderId });
  };

  const closeContextMenu = useCallback(() => {
    // console.log("Closing context menu");
    setContextMenu(prev => ({ ...prev, visible: false, folderId: null }));
  }, []);
  
  const contextMenuOptions = contextMenu.folderId ? [
    { label: 'View Items', action: () => handleViewFolderContents(contextMenu.folderId) },
    { label: 'Rename List', action: () => startRenameFolder(contextMenu.folderId) },
    { label: 'Delete List', action: () => confirmDeleteFolder(contextMenu.folderId) },
  ] : [];

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
                    {folders.map(folder => ( // Iterate over `folders` directly
                      <FolderCardInternal 
                        key={folder.id} 
                        folder={folder} // Pass the folder data which now includes previewItemDetails (if you decide to fetch them separately for icons later)
                        onClick={handleViewFolderContents} 
                        onContextMenu={handleRightClickFolder} 
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {activeDragItem && activeDragItem.type === 'folder-card' && activeDragItem.data ? (
                    // This drag overlay can be simplified if not showing image previews
                    <div className="drag-overlay-folder-card"> 
                        <DefaultFolderIcon />
                        <h4>{activeDragItem.data.name}</h4>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : !isLoadingContextFolders ? ( 
              <div className="empty-watchlist-container">
                <svg className="empty-watchlist-icon" viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 8H14c-2.21 0-4 1.79-4 4v36c0 2.21 1.79 4 4 4h36c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zm-2 38H16V14h32v32z"/><path d="M24 22h16v2H24zM24 28h16v2H24zM24 34h10v2H24z"/></svg>
                <h2>Your Watchlist is Empty</h2>
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
            onRemoveItemFromFolder={removeItemFromFolder} 
            isLoadingItems={isLoadingFolderItemsDetails}
          />
        ) : (
          // This fallback is important if selectedFolderId points to a non-existent/deleted folder
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
      {contextMenu.visible && <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenuOptions} onClose={closeContextMenu} />}
    </div>
  );
};

export default Watchlist;