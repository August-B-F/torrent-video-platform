import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useAddons } from './AddonContext'; // To get Cinemeta for item details

export const WatchlistContext = createContext({
  folders: [],
  isLoadingFolders: true,
  addFolder: () => {},
  renameFolder: () => {},
  deleteFolder: () => {},
  addItemToFolder: async () => {},
  removeItemFromFolder: () => {},
  reorderItemsInFolder: () => {},
  reorderFolders: () => {},
  itemDetailsCache: {}, // Share cache if useful
  fetchItemDetails: async () => null, // Function to get details
});

export const WatchlistProvider = ({ children }) => {
  const { cinemeta, isLoadingCinemeta } = useAddons();
  const [folders, setFolders] = useState([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [itemDetailsCache, setItemDetailsCache] = useState({});

  // --- Load and Save Folders from/to localStorage ---
  useEffect(() => {
    setIsLoadingFolders(true);
    const storedFolders = JSON.parse(localStorage.getItem('userWatchlistFoldersV2'));
    if (storedFolders && Array.isArray(storedFolders) && storedFolders.length > 0) {
      setFolders(storedFolders);
    } else {
      setFolders([{ id: 'default', name: 'My First List', items: [] }]); // Initialize with a default
    }
    setIsLoadingFolders(false);
  }, []);

  useEffect(() => {
    if (!isLoadingFolders) {
      localStorage.setItem('userWatchlistFoldersV2', JSON.stringify(folders));
    }
  }, [folders, isLoadingFolders]);

  // --- Item Detail Fetching & Caching ---
  const fetchItemDetails = useCallback(async (itemId, itemTypeHint) => {
    if (!itemId) return null;
    if (itemDetailsCache[itemId]) return itemDetailsCache[itemId];
    if (!cinemeta || isLoadingCinemeta) return null; // Cinemeta not ready

    let itemType = itemTypeHint;
    if (!itemType) { // Try to guess type if not provided (less reliable)
        itemType = itemId.startsWith('tt') ? 'movie' : 'series';
    }

    try {
      const metaRes = await cinemeta.get('meta', itemType, itemId);
      if (metaRes.meta) {
        setItemDetailsCache(prevCache => ({ ...prevCache, [itemId]: metaRes.meta }));
        return metaRes.meta;
      }
    } catch (e) {
      console.warn(`WatchlistContext: Could not fetch metadata for ${itemId} (type ${itemType}):`, e.message);
      // Attempt other type if initial hint failed and was a guess
      if (itemTypeHint !== (itemType === 'movie' ? 'series' : 'movie')) {
        try {
            const otherType = itemType === 'movie' ? 'series' : 'movie';
            const metaRes = await cinemeta.get('meta', otherType, itemId);
            if (metaRes.meta) {
                setItemDetailsCache(prevCache => ({ ...prevCache, [itemId]: {...metaRes.meta, type: otherType } })); // Store with correct type
                return {...metaRes.meta, type: otherType };
            }
        } catch (e2) {
            console.warn(`WatchlistContext: Also failed fetching ${itemId} as other type:`, e2.message);
        }
      }
    }
    return { id: itemId, name: `Item ${itemId}`, posterUrl: '', type: itemType }; // Fallback
  }, [cinemeta, isLoadingCinemeta, itemDetailsCache]);


  // --- Folder Actions ---
  const addFolder = (name) => {
    const newFolder = { id: `folder-${Date.now()}`, name, items: [] };
    setFolders(prev => [...prev, newFolder]);
  };

  const renameFolder = (folderId, newName) => {
    setFolders(prev => prev.map(f => (f.id === folderId ? { ...f, name: newName } : f)));
  };

  const deleteFolder = (folderId) => {
    if (folderId === 'default' && folders.length <= 1) {
      alert("Cannot delete the last default folder. Create another list first.");
      return false;
    }
    if (window.confirm(`Are you sure you want to delete this folder and its contents?`)) {
      setFolders(prev => prev.filter(f => f.id !== folderId));
      return true;
    }
    return false;
  };
  
  const reorderFolders = (reorderedFolders) => {
    setFolders(reorderedFolders);
  };

  // --- Item Actions ---
  const addItemToFolder = useCallback(async (itemId, itemTypeHint, targetFolderId = null) => {
    if (!cinemeta && !isLoadingCinemeta) {
      alert("Cinemeta addon is not ready. Cannot add item.");
      return;
    }
    if (isLoadingCinemeta) {
      alert("Addons are loading, please try again shortly.");
      return;
    }

    const itemDetail = itemDetailsCache[itemId] || await fetchItemDetails(itemId, itemTypeHint);

    if (!itemDetail || !itemDetail.type) { // Ensure type is known
        alert(`Could not get details or type for item ID ${itemId}. Cannot add to watchlist.`);
        return;
    }
    
    const itemToAdd = { id: itemId, type: itemDetail.type }; // Store with ID and Type

    let actualTargetFolderId = targetFolderId;
    let targetFolder = folders.find(f => f.id === actualTargetFolderId);

    if (!targetFolder) {
      const defaultFolder = folders.find(f => f.id === 'default') || folders[0];
      if (!defaultFolder) {
        const newDefaultFolder = { id: 'default', name: 'My First List', items: [itemToAdd] };
        setFolders(prev => [newDefaultFolder, ...prev.filter(f => f.id !== 'default')]);
        alert(`"${itemDetail.name || itemId}" added to new default list.`);
        return;
      }
      actualTargetFolderId = defaultFolder.id;
    }

    setFolders(prevFolders =>
      prevFolders.map(folder => {
        if (folder.id === actualTargetFolderId) {
          if (folder.items.some(i => i.id === itemId)) {
            alert(`"${itemDetail.name || itemId}" is already in "${folder.name}".`);
            return folder;
          }
          return { ...folder, items: [itemToAdd, ...folder.items] }; // Add new item
        }
        return folder;
      })
    );
    alert(`"${itemDetail.name || itemId}" added to "${folders.find(f => f.id === actualTargetFolderId)?.name}".`);
  }, [folders, cinemeta, isLoadingCinemeta, fetchItemDetails, itemDetailsCache]);

  const removeItemFromFolder = (folderId, itemIdToRemove) => {
    setFolders(prev =>
      prev.map(f =>
        f.id === folderId
          ? { ...f, items: f.items.filter(item => item.id !== itemIdToRemove) }
          : f
      )
    );
  };

  const reorderItemsInFolder = (folderId, reorderedItemObjects) => { // Expecting array of {id, type}
    setFolders(prev =>
      prev.map(f => (f.id === folderId ? { ...f, items: reorderedItemObjects } : f))
    );
  };

  const moveItemToFolder = (sourceFolderId, targetFolderId, itemId, itemType) => {
    if (sourceFolderId === targetFolderId) return;
    const itemToMove = { id: itemId, type: itemType };
    
    setFolders(prev => {
        let foundItem = null;
        // Remove from source
        const newFolders = prev.map(f => {
            if (f.id === sourceFolderId) {
                const itemIndex = f.items.findIndex(i => i.id === itemId);
                if (itemIndex > -1) {
                    // foundItem = f.items[itemIndex]; // Already have itemToMove
                    return { ...f, items: f.items.filter(i => i.id !== itemId) };
                }
            }
            return f;
        });
        // Add to target
        return newFolders.map(f => {
            if (f.id === targetFolderId) {
                if (!f.items.some(i => i.id === itemId)) { // Avoid duplicates if somehow still there
                    return { ...f, items: [itemToMove, ...f.items] };
                }
            }
            return f;
        });
    });
  };


  return (
    <WatchlistContext.Provider value={{
      folders,
      isLoadingFolders,
      addFolder,
      renameFolder,
      deleteFolder,
      addItemToFolder,
      removeItemFromFolder,
      reorderItemsInFolder,
      reorderFolders,
      itemDetailsCache, // Provide cache for previews
      fetchItemDetails, // Provide fetcher for item details
      moveItemToFolder, // For moving items between folders
    }}>
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => useContext(WatchlistContext);