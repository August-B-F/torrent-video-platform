import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useAddons } from './AddonContext';
import { usePopup } from './PopupContext';

// Default folder icon (can be expanded with more options)
export const FOLDER_ICON_OPTIONS = {
  DEFAULT: 'default', // Represents the SVG folder icon
  MOVIE: 'movie',
  SERIES: 'series',
  // Add more keywords for other SVGs or allow direct emoji input
};

export const WatchlistContext = createContext({
  folders: [],
  isLoadingFolders: true,
  addFolder: (name) => {},
  renameFolder: (folderId, newName) => {},
  deleteFolder: (folderId) => false,
  updateFolderAppearance: (folderId, { icon, color }) => {},
  // Modified function signature for clarity
  updateItemInFolders: async (itemId, itemTypeHint, targetFolderIds, initialFolderIdsItemWasIn) => {},
  removeItemFromFolder: (folderId, itemIdToRemove) => {},
  reorderItemsInFolder: (folderId, reorderedItems) => {},
  reorderFolders: (reorderedFoldersArray) => {},
  itemDetailsCache: {},
  fetchItemDetails: async (itemId, itemTypeHint) => null,
  moveItemToFolder: (sourceFolderId, targetFolderId, itemId, itemType) => {},
  getItemFolderIds: (itemId) => [], // New function
});

export const WatchlistProvider = ({ children }) => {
  const { cinemeta, isLoadingCinemeta } = useAddons();
  const { showPopup } = usePopup();
  const [folders, setFolders] = useState([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [itemDetailsCache, setItemDetailsCache] = useState({});

  const defaultFolderProps = {
    icon: FOLDER_ICON_OPTIONS.DEFAULT,
    color: '#2E3039',
  };

  useEffect(() => {
    setIsLoadingFolders(true);
    try {
      const storedFoldersRaw = localStorage.getItem('userWatchlistFoldersV3');
      if (storedFoldersRaw) {
        const storedFoldersParsed = JSON.parse(storedFoldersRaw);
        if (storedFoldersParsed && Array.isArray(storedFoldersParsed)) {
          const migratedFolders = storedFoldersParsed.map(folder => ({
            ...defaultFolderProps,
            ...folder,
            items: Array.isArray(folder.items) ? folder.items.map(item => typeof item === 'string' ? { id: item, type: 'movie' } : item) : [] // Ensure items are objects
          }));
          setFolders(migratedFolders.length > 0 ? migratedFolders : [{ ...defaultFolderProps, id: 'default', name: 'My First List', items: [] }]);
        } else {
          setFolders([{ ...defaultFolderProps, id: 'default', name: 'My First List', items: [] }]);
        }
      } else {
        setFolders([{ ...defaultFolderProps, id: 'default', name: 'My First List', items: [] }]);
      }
    } catch (error) {
      console.error("Error parsing folders from localStorage:", error);
      setFolders([{ ...defaultFolderProps, id: 'default', name: 'My First List', items: [] }]);
    }
    setIsLoadingFolders(false);
  }, []);

  useEffect(() => {
    if (!isLoadingFolders) {
      localStorage.setItem('userWatchlistFoldersV3', JSON.stringify(folders));
    }
  }, [folders, isLoadingFolders]);

  const fetchItemDetails = useCallback(async (itemId, itemTypeHint) => {
    if (!itemId) return null;
    if (itemDetailsCache[itemId]) return itemDetailsCache[itemId];
    if (!cinemeta || isLoadingCinemeta) return null;

    let itemType = itemTypeHint;
    if (!itemType) itemType = itemId.startsWith('tt') || itemId.startsWith('imdb') ? 'movie' : 'series';

    try {
      const metaRes = await cinemeta.get('meta', itemType, itemId);
      if (metaRes && metaRes.meta) {
        const detailWithType = { ...metaRes.meta, type: itemType };
        setItemDetailsCache(prevCache => ({ ...prevCache, [itemId]: detailWithType }));
        return detailWithType;
      }
    } catch (e) {
      const otherType = itemType === 'movie' ? 'series' : 'movie';
      if (!itemTypeHint || itemTypeHint !== otherType) {
        try {
          const metaResOther = await cinemeta.get('meta', otherType, itemId);
          if (metaResOther && metaResOther.meta) {
            const detailWithOtherType = { ...metaResOther.meta, type: otherType };
            setItemDetailsCache(prevCache => ({ ...prevCache, [itemId]: detailWithOtherType }));
            return detailWithOtherType;
          }
        } catch (e2) { /* console.warn(...) */ }
      }
    }
    return { id: itemId, name: `Item ${itemId}`, poster: '', posterUrl: '', type: itemTypeHint || 'movie' };
  }, [cinemeta, isLoadingCinemeta, itemDetailsCache]);

  const addFolder = (name) => {
    const newFolder = {
        ...defaultFolderProps,
        id: `folder-${Date.now()}`,
        name,
        items: []
    };
    setFolders(prev => [...prev, newFolder]);
    showPopup(`List "${name}" created.`, "success");
  };

  const renameFolder = (folderId, newName) => {
    let oldName = '';
    setFolders(prev => prev.map(f => {
      if (f.id === folderId) {
        oldName = f.name;
        return { ...f, name: newName };
      }
      return f;
    }));
    if (oldName && oldName !== newName) {
      showPopup(`List "${oldName}" renamed to "${newName}".`, "success");
    }
  };

  const updateFolderAppearance = (folderId, { icon, color }) => {
    setFolders(prev => prev.map(f => {
        if (f.id === folderId) {
            return {
                ...f,
                icon: icon !== undefined ? icon : f.icon,
                color: color !== undefined ? color : f.color
            };
        }
        return f;
    }));
    showPopup("List appearance updated.", "success");
  };


  const deleteFolder = (folderId) => {
    const folderToDelete = folders.find(f => f.id === folderId);
    if (!folderToDelete) return false;

    if (folderId === 'default' && folders.length <= 1) {
      showPopup("Cannot delete the last default list. Create another list first.", "warning");
      return false;
    }
    if (window.confirm(`Are you sure you want to delete the list "${folderToDelete.name}" and its contents?`)) {
      setFolders(prev => prev.filter(f => f.id !== folderId));
      showPopup(`List "${folderToDelete.name}" deleted.`, "success");
      return true;
    }
    return false;
  };

  const reorderFolders = (reorderedFoldersArray) => {
    setFolders(reorderedFoldersArray);
  };
  
  const getItemFolderIds = useCallback((itemId) => {
    return folders.filter(folder => folder.items.some(item => item.id === itemId)).map(folder => folder.id);
  }, [folders]);

  const updateItemInFolders = useCallback(async (itemId, itemTypeHint, targetFolderIds, initialFolderIdsItemWasIn) => {
    if ((!cinemeta && !isLoadingCinemeta) || isLoadingCinemeta) {
        showPopup("Addon service is not ready. Please try again shortly.", "warning");
        return;
    }

    const itemDetail = itemDetailsCache[itemId] || await fetchItemDetails(itemId, itemTypeHint);

    if (!itemDetail || !itemDetail.type || !itemDetail.name) {
        showPopup(`Could not get details for item ID ${itemId}. Cannot update lists.`, "warning");
        return;
    }
    
    const itemObject = { id: itemId, type: itemDetail.type };
    const finalTargetFolderIds = new Set(targetFolderIds);
    const initialFolderIds = new Set(initialFolderIdsItemWasIn);

    let addedToNames = [];
    let removedFromNames = [];

    setFolders(prevFolders =>
        prevFolders.map(folder => {
            const itemExistsInFolder = folder.items.some(i => i.id === itemId);
            const shouldBeInFolder = finalTargetFolderIds.has(folder.id);

            if (itemExistsInFolder && !shouldBeInFolder) {
                // Remove item
                removedFromNames.push(folder.name);
                return { ...folder, items: folder.items.filter(i => i.id !== itemId) };
            } else if (!itemExistsInFolder && shouldBeInFolder) {
                // Add item
                addedToNames.push(folder.name);
                return { ...folder, items: [itemObject, ...folder.items] };
            }
            return folder;
        })
    );
    
    if (addedToNames.length > 0) {
        showPopup(`"${itemDetail.name}" added to ${addedToNames.map(name => `"${name}"`).join(', ')}.`, "success");
    }
    if (removedFromNames.length > 0) {
        showPopup(`"${itemDetail.name}" removed from ${removedFromNames.map(name => `"${name}"`).join(', ')}.`, "info");
    }
    if (addedToNames.length === 0 && removedFromNames.length === 0) {
        // This case might happen if selections didn't actually change the item's status in any folder.
        // Or if the item was already in all selected folders and no unselected folders.
        // showPopup("No changes made to lists.", "info");
    }

  }, [folders, cinemeta, isLoadingCinemeta, fetchItemDetails, itemDetailsCache, showPopup]);


  const removeItemFromFolder = (folderId, itemIdToRemove) => {
    const folder = folders.find(f => f.id === folderId);
    const item = itemDetailsCache[itemIdToRemove] || { name: `Item ${itemIdToRemove}` };

    setFolders(prev =>
      prev.map(f =>
        f.id === folderId
          ? { ...f, items: f.items.filter(itemObj => itemObj.id !== itemIdToRemove) }
          : f
      )
    );
    showPopup(`"${item.name}" removed from "${folder ? folder.name : 'the list'}".`, 'info');
  };

  const reorderItemsInFolder = (folderId, reorderedItemObjects) => {
    setFolders(prev =>
      prev.map(f => (f.id === folderId ? { ...f, items: reorderedItemObjects.map(item => ({id: item.id, type: item.type})) } : f))
    );
  };

  const moveItemToFolder = (sourceFolderId, targetFolderId, itemId, itemType) => {
    if (sourceFolderId === targetFolderId) return;
    const itemToMove = { id: itemId, type: itemType };

    let movedItemName = itemDetailsCache[itemId]?.name || `Item ${itemId}`;
    let sourceFolderName = "";
    let targetFolderName = "";

    setFolders(prev => {
        const sFolder = prev.find(f => f.id === sourceFolderId);
        if (sFolder) sourceFolderName = sFolder.name;
        const tFolder = prev.find(f => f.id === targetFolderId);
        if (tFolder) targetFolderName = tFolder.name;

        const newFolders = prev.map(f => {
            if (f.id === sourceFolderId) {
                return { ...f, items: f.items.filter(i => i.id !== itemId) };
            }
            return f;
        });
        return newFolders.map(f => {
            if (f.id === targetFolderId) {
                if (!f.items.some(i => i.id === itemId)) {
                    return { ...f, items: [itemToMove, ...f.items] };
                }
            }
            return f;
        });
    });
    if (sourceFolderName && targetFolderName) {
        showPopup(`"${movedItemName}" moved from "${sourceFolderName}" to "${targetFolderName}".`, 'success');
    }
  };

  return (
    <WatchlistContext.Provider value={{
      folders,
      isLoadingFolders,
      addFolder,
      renameFolder,
      deleteFolder,
      updateFolderAppearance,
      updateItemInFolders, // Use new function
      removeItemFromFolder,
      reorderItemsInFolder,
      reorderFolders,
      itemDetailsCache,
      fetchItemDetails,
      moveItemToFolder,
      getItemFolderIds, // Expose new helper
    }}>
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => useContext(WatchlistContext);