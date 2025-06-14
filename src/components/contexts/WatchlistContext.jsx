import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useAddons } from './AddonContext';
import { usePopup } from './PopupContext';

export const FOLDER_ICON_OPTIONS = {
  DEFAULT: 'default_folder_icon', 
  MOVIE: 'default_movie_icon',   
  SERIES: 'default_series_icon', 
  IMAGE_URL: 'image_url',       
  EMOJI: 'emoji_type'           
};

export const WatchlistContext = createContext({
  folders: [],
  isLoadingFolders: true,
  addFolder: (name) => {},
  renameFolder: (folderId, newName) => {},
  deleteFolder: (folderId) => false,
  updateFolderAppearance: (folderId, { iconType, iconValue, color }) => {}, 
  addItemToFolders: async (itemId, itemTypeHint, targetFolderIds) => {}, 
  removeItemFromFolder: (folderId, itemIdToRemove) => {},
  reorderItemsInFolder: (folderId, reorderedItems) => {},
  reorderFolders: (reorderedFoldersArray) => {},
  itemDetailsCache: {},
  fetchItemDetails: async (itemId, itemTypeHint) => null,
  moveItemToFolder: (sourceFolderId, targetFolderId, itemId, itemType) => {},
  isItemInFolder: (itemId, folderId) => false, 
});

export const WatchlistProvider = ({ children }) => {
  const { cinemeta, isLoadingCinemeta } = useAddons();
  const { showPopup } = usePopup();
  const [folders, setFolders] = useState([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [itemDetailsCache, setItemDetailsCache] = useState({});

  const defaultFolderProps = {
    iconType: FOLDER_ICON_OPTIONS.DEFAULT,
    iconValue: null,
    color: '#2E3039',
  };

  useEffect(() => {
    setIsLoadingFolders(true);
    try {
      const storedFoldersRaw = localStorage.getItem('userWatchlistFoldersV4');
      if (storedFoldersRaw) {
        const storedFoldersParsed = JSON.parse(storedFoldersRaw);
        if (storedFoldersParsed && Array.isArray(storedFoldersParsed)) {
          const migratedFolders = storedFoldersParsed.map(folder => ({
            ...defaultFolderProps,
            ...folder,
            iconType: folder.iconType || (folder.icon && (folder.icon.startsWith('http') || folder.icon.startsWith('data:')) ? FOLDER_ICON_OPTIONS.IMAGE_URL : (folder.icon && folder.icon.length <= 2 && /\p{Emoji}/u.test(folder.icon)) ? FOLDER_ICON_OPTIONS.EMOJI : folder.icon || defaultFolderProps.iconType),
            iconValue: folder.iconValue || (folder.icon && (folder.icon.startsWith('http') || folder.icon.startsWith('data:') || (folder.icon && folder.icon.length <= 2 && /\p{Emoji}/u.test(folder.icon))) ? folder.icon : null),
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
      localStorage.setItem('userWatchlistFoldersV4', JSON.stringify(folders));
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
        } catch (e2) { }
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

  const updateFolderAppearance = (folderId, { iconType, iconValue, color }) => {
    setFolders(prev => prev.map(f => {
        if (f.id === folderId) {
            return {
                ...f,
                iconType: iconType !== undefined ? iconType : f.iconType,
                iconValue: iconValue !== undefined ? iconValue : f.iconValue,
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

  const addItemToFolders = useCallback(async (itemId, itemTypeHint, targetFolderIds) => {
    if ((!cinemeta && !isLoadingCinemeta) || isLoadingCinemeta) {
      showPopup("Addon service is not ready. Please try again shortly.", "warning");
      return;
    }

    const itemDetail = itemDetailsCache[itemId] || await fetchItemDetails(itemId, itemTypeHint);

    if (!itemDetail || !itemDetail.type || !itemDetail.name) {
      showPopup(`Could not get details for item ID ${itemId}. Cannot add to list.`, "warning");
      return;
    }

    const itemToAdd = { id: itemId, type: itemDetail.type };
    const folderIdsArray = Array.isArray(targetFolderIds) ? targetFolderIds : [targetFolderIds].filter(Boolean);

    if (folderIdsArray.length === 0) {
        showPopup("No lists selected to add the item to.", "info");
        return;
    }

    let itemsActuallyAddedCount = 0;
    let addedToFolderNames = [];

    setFolders(prevFolders =>
      prevFolders.map(folder => {
        if (folderIdsArray.includes(folder.id)) {
          if (!folder.items.some(i => i.id === itemId)) {
            itemsActuallyAddedCount++;
            addedToFolderNames.push(folder.name);
            return { ...folder, items: [itemToAdd, ...folder.items] };
          }
        }
        return folder;
      })
    );

    if (itemsActuallyAddedCount > 0) {
        showPopup(`"${itemDetail.name}" added to ${addedToFolderNames.map(name => `"${name}"`).join(', ')}.`, "success");
    } else if (folderIdsArray.length > 0) {
        const allTargetFolders = folders.filter(f => folderIdsArray.includes(f.id)).map(f => f.name);
         showPopup(`"${itemDetail.name}" is already in ${allTargetFolders.map(name => `"${name}"`).join(', ')}.`, "info");
    }
  }, [folders, cinemeta, isLoadingCinemeta, fetchItemDetails, itemDetailsCache, showPopup]);

  const removeItemFromFolder = useCallback((folderId, itemIdToRemove) => {
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
  }, [folders, itemDetailsCache, showPopup]);

  const isItemInFolder = useCallback((itemId, folderId) => {
    const folder = folders.find(f => f.id === folderId);
    return folder ? folder.items.some(item => item.id === itemId) : false;
  }, [folders]);


  const reorderItemsInFolder = (folderId, reorderedItems) => { 
    setFolders(prev =>
      prev.map(f => (f.id === folderId ? { ...f, items: reorderedItems.map(item => ({id: item.id, type: item.type})) } : f))
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
      addItemToFolders,
      removeItemFromFolder,
      reorderItemsInFolder,
      reorderFolders,
      itemDetailsCache,
      fetchItemDetails,
      moveItemToFolder,
      isItemInFolder,
    }}>
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => useContext(WatchlistContext);