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
import MediaGridItem from '../../common/MediaGridItem/MediaGridItem';
import CreateFolderModal from './CreateFolderModal';
import ContextMenu from '../../common/ContextMenu/ContextMenu';
import './WatchlistStyle.css';

// --- Sortable Folder Card Component (Inlined for this example) ---
const FolderCard = ({ folder, onClick, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: folder.id, data: { type: 'folder-card', folder } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, cursor: 'grab' };
  const previewItems = folder.previewItemDetails || [];
  return (
    <div ref={setNodeRef} style={style} className="folder-card" onClick={() => onClick(folder.id)} onContextMenu={(e) => onContextMenu(e, folder.id)} {...attributes} {...listeners} >
      <div className="folder-card-preview">
        {previewItems.length > 0 ? ( previewItems.slice(0, 4).map((item, index) => ( item && <img key={item.id || `prev-${index}`} src={item.posterUrl || item.poster} alt={item.title || item.name || ''} className="preview-poster" />))
        ) : ( <div className="empty-preview-placeholder">Empty List</div> )}
        {Array.from({ length: Math.max(0, 4 - previewItems.length) }).map((_, i) => ( <div key={`placeholder-${i}`} className="preview-poster placeholder"></div> ))}
      </div>
      <h3 className="folder-card-name">{folder.name} ({folder.items.length})</h3>
    </div>
  );
};

// --- Sortable Item for Folder Content View (Inlined) ---
const SortableFolderItem = ({ id, itemData, onRemoveItemFromFolderCallback }) => { // Renamed prop to avoid conflict
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: 'folder-item', itemData } });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, cursor: 'grab' };
    return (
        <div ref={setNodeRef} style={style} className="folder-content-grid-item-wrapper" {...attributes} {...listeners}>
        <MediaGridItem item={itemData.details} />
        <button className="item-action-btn remove-item" onClick={(e) => { e.stopPropagation(); onRemoveItemFromFolderCallback(itemData.id);}} title="Remove from this list"> &times; </button>
        </div>
    );
};

// --- Folder Content View (Inlined) ---
const FolderContentView = ({ folder, itemsWithDetails, onBack, onReorderItemsInFolderCallback, onRemoveItemFromFolderCallback, isLoadingItems }) => { // Renamed props
    const [activeDragItem, setActiveDragItem] = useState(null);
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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
            const reorderedItemObjects = arrayMove(itemsWithDetails, oldIndex, newIndex);
            onReorderItemsInFolderCallback(folder.id, reorderedItemObjects);
        }
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
                        <SortableFolderItem key={itemData.id} id={itemData.id} itemData={itemData}
                        onRemoveItemFromFolderCallback={() => onRemoveItemFromFolderCallback(folder.id, itemData.id)} />
                    ))}
                    </div>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                    {activeDragItem && activeDragItem.data?.itemData?.details ? (
                    <div className="drag-overlay-item"> <MediaGridItem item={activeDragItem.data.itemData.details} /> </div>
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
    itemDetailsCache, fetchItemDetails
  } = useWatchlist();

  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, folderId: null });
  
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [isLoadingFolderItemsDetails, setIsLoadingFolderItemsDetails] = useState(false); // Corrected variable name
  const [currentFolderItemsWithDetails, setCurrentFolderItemsWithDetails] = useState([]);
  const [foldersWithPreviews, setFoldersWithPreviews] = useState([]);

  // --- Load and Sync Folders with Previews ---
  useEffect(() => {
    if (isLoadingContextFolders || !folders.length) {
        setFoldersWithPreviews(folders || []);
        return;
    }
    const updatePreviews = async () => {
      const newFoldersWithPreviews = await Promise.all(
        folders.map(async (folder) => {
          const previewItemDetails = await Promise.all(
            folder.items.slice(0, 4).map(async (itemObj) => {
                const detail = itemDetailsCache[itemObj.id] || await fetchItemDetails(itemObj.id, itemObj.type);
                return detail;
            })
          );
          return { ...folder, previewItemDetails: previewItemDetails.filter(Boolean) };
        })
      );
      setFoldersWithPreviews(newFoldersWithPreviews);
    };
    updatePreviews();
  }, [folders, itemDetailsCache, fetchItemDetails, isLoadingContextFolders]);

  // --- Fetch full details for items in the currently selected folder ---
  useEffect(() => {
    const selectedFolderData = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;
    if (selectedFolderData) {
      setIsLoadingFolderItemsDetails(true); // Use the corrected state variable
      const fetchAllDetails = async () => {
        const detailedItems = await Promise.all(
          selectedFolderData.items.map(async (itemObj) => {
            const detail = itemDetailsCache[itemObj.id] || await fetchItemDetails(itemObj.id, itemObj.type);
            return { id: itemObj.id, type: itemObj.type, details: detail || { name: `Item ${itemObj.id}`, posterUrl: '', id: itemObj.id, type: itemObj.type } };
          })
        );
        setCurrentFolderItemsWithDetails(detailedItems);
        setIsLoadingFolderItemsDetails(false); // Use the corrected state variable
      };
      fetchAllDetails();
    } else {
      setCurrentFolderItemsWithDetails([]);
    }
  }, [selectedFolderId, folders, itemDetailsCache, fetchItemDetails]);

  // --- DND Sensors ---
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // --- Folder Operation Handlers ---
  const handleCreateFolderSubmit = (name) => { // DEFINED a handler for the modal
    addFolder(name); // Call the function from context
  };

  const startRenameFolder = (folderId) => {
    const folder = folders.find(f => f.id === folderId);
    const newName = prompt("Enter new folder name:", folder?.name);
    if (newName && newName.trim() !== "" && folder && newName.trim() !== folder.name) {
      renameFolder(folderId, newName.trim());
    }
    closeContextMenu();
  };

  const confirmDeleteFolder = (folderId) => { // Renamed to avoid conflict if deleteFolder is directly used
    if (deleteFolder(folderId)) { // deleteFolder from context now returns true/false
        if (selectedFolderId === folderId) setSelectedFolderId(null);
    }
    closeContextMenu();
  };

  // --- DND Handlers for Folder Cards ---
  const handleFolderDragStart = (event) => {
    const { active } = event;
    const folderData = folders.find(f => f.id === active.id); // Ensure we use current folders state
    setActiveDragItem({ id: active.id, type: 'folder-card', data: folderData });
  };

  const handleFolderDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (over && active.id !== over.id && active.data.current?.type === 'folder-card' && over.data.current?.type === 'folder-card') {
      const oldIndex = folders.findIndex(item => item.id === active.id);
      const newIndex = folders.findIndex(item => item.id === over.id);
      reorderFolders(arrayMove(folders, oldIndex, newIndex)); // Call context function
    }
  };

  // --- Context Menu ---
  const handleRightClickFolder = (event, folderId) => {
    event.preventDefault();
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, folderId });
  };
  const closeContextMenu = useCallback(() => setContextMenu(prev => ({ ...prev, visible: false })), []);
  
  const contextMenuOptions = contextMenu.folderId ? [
    { label: 'Rename List', action: () => startRenameFolder(contextMenu.folderId) },
    { label: 'Delete List', action: () => confirmDeleteFolder(contextMenu.folderId) }, // Use confirmDeleteFolder
  ] : [];

  // --- Render Logic ---
  const selectedFolderDataForView = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;

  if (isLoadingContextFolders) {
    return <div className="page-container watchlist-page"><div className="loading-message">Loading Lists...</div></div>;
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
            {foldersWithPreviews.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleFolderDragStart} onDragEnd={handleFolderDragEnd}>
                <SortableContext items={foldersWithPreviews.map(f => f.id)} strategy={rectSortingStrategy}>
                  <div className="folder-grid">
                    {foldersWithPreviews.map(folder => (
                      <FolderCard key={folder.id} folder={folder} onClick={setSelectedFolderId} onContextMenu={handleRightClickFolder} />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {activeDragItem && activeDragItem.type === 'folder-card' && activeDragItem.data ? (
                    <div className="drag-overlay-folder-card"><h4>{activeDragItem.data.name}</h4></div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <div className="empty-watchlist-container">
                <svg className="empty-watchlist-icon" viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 8H14c-2.21 0-4 1.79-4 4v36c0 2.21 1.79 4 4 4h36c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zm-2 38H16V14h32v32z"/><path d="M24 22h16v2H24zM24 28h16v2H24zM24 34h10v2H24z"/></svg>
                <h2>Your Watchlist is Empty</h2>
                <p>Create lists to organize movies and series you want to watch.</p>
                <button onClick={() => setIsCreateModalOpen(true)} className="create-folder-btn large">
                  + Create Your First List
                </button>
              </div>
            )}
          </>
        ) : selectedFolderDataForView ? (
          <FolderContentView
            folder={selectedFolderDataForView}
            itemsWithDetails={currentFolderItemsWithDetails}
            onBack={() => setSelectedFolderId(null)}
            onReorderItemsInFolderCallback={reorderItemsInFolder} // Pass context reorder function
            onRemoveItemFromFolderCallback={removeItemFromFolder} // Pass context remove function
            isLoadingItems={isLoadingFolderItemsDetails} // Use the corrected state variable
          />
        ) : (
          <div className="empty-message">
            Folder not found or has been deleted.
            <button onClick={() => setSelectedFolderId(null)} className="back-to-folders-btn" style={{marginLeft: '10px'}}>Go back to lists</button>
          </div>
        )}
      </main>
      <CreateFolderModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreateFolder={handleCreateFolderSubmit} />
      {contextMenu.visible && <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenuOptions} onClose={closeContextMenu} />}
    </div>
  );
};

export default Watchlist;