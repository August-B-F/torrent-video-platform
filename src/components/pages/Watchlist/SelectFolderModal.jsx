import React, { useState, useEffect, useCallback } from 'react';
import { useWatchlist } from '../../contexts/WatchlistContext'; // Import useWatchlist
import './SelectFolderModal.css';

const SelectFolderModal = ({ isOpen, onClose, folders: allFoldersFromContext, onItemAddMultiple, itemTitle, itemId, itemType }) => {
  const { addItemToFolders, removeItemFromFolder, isItemInFolder } = useWatchlist();
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [initialFolderIds, setInitialFolderIds] = useState([]); // Store initial state
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && itemId && allFoldersFromContext.length > 0) {
      const idsContainingItem = allFoldersFromContext
        .filter(folder => folder.items.some(item => item.id === itemId))
        .map(folder => folder.id);
      setSelectedFolderIds(idsContainingItem);
      setInitialFolderIds(idsContainingItem); // Store the initial state
      setError('');
    } else if (!isOpen) {
        // Reset when modal is closed
        setSelectedFolderIds([]);
        setInitialFolderIds([]);
        setError('');
    }
  }, [isOpen, itemId, allFoldersFromContext]);

  if (!isOpen) return null;

  const handleCheckboxChange = (folderId) => {
    setSelectedFolderIds(prevSelected =>
      prevSelected.includes(folderId)
        ? prevSelected.filter(id => id !== folderId)
        : [...prevSelected, folderId]
    );
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // No need to check for empty selection here if we allow removing from all.
    // But if you want to enforce "must be in at least one", add a check.

    const foldersToAdd = selectedFolderIds.filter(id => !initialFolderIds.includes(id));
    const foldersToRemove = initialFolderIds.filter(id => !selectedFolderIds.includes(id));

    let operationsSuccessful = true;

    if (foldersToAdd.length > 0) {
      // The addItemToFolders from context now handles multiple IDs and checks for existing items.
      await addItemToFolders(itemId, itemType, foldersToAdd);
    }

    for (const folderId of foldersToRemove) {
      // removeItemFromFolder is synchronous in current context, but could be async
      await removeItemFromFolder(folderId, itemId);
    }
    
    // Call the original onItemAddMultiple if it's meant for something else,
    // or remove if its sole purpose was to pass selected IDs.
    // For now, we assume the modal handles its own add/remove logic via context.
    if (typeof onItemAddMultiple === 'function' && (foldersToAdd.length > 0 || foldersToRemove.length > 0) ) {
      // This callback might need to be re-evaluated. If its purpose was just to trigger
      // an action with the selected IDs, the new logic above handles it.
      // If it was for additional specific actions after add/remove, it can be called.
      // For simplicity, we'll assume it's for notifying the parent of changes.
      onItemAddMultiple(selectedFolderIds); // Pass the final selection state
    }


    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content select-folder-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Manage "{itemTitle}" in Lists</h2>
        {allFoldersFromContext.length > 0 ? (
          <form onSubmit={handleSubmit}>
            <p className="select-folder-instruction">Select lists to include this item in:</p>
            <div className="folder-selection-list">
              {allFoldersFromContext.map(folder => (
                <label key={folder.id} className="folder-select-item">
                  <input
                    type="checkbox"
                    checked={selectedFolderIds.includes(folder.id)}
                    onChange={() => handleCheckboxChange(folder.id)}
                  />
                  <span className="checkbox-custom"></span>
                  <span className="folder-select-name">{folder.name} <span className="item-count">({folder.items.length} items)</span></span>
                </label>
              ))}
            </div>
            {error && <p className="modal-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" onClick={onClose} className="modal-button cancel">
                Cancel
              </button>
              <button type="submit" className="modal-button create">
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="empty-message modal-empty-message">You don't have any lists yet. Please create one on the "My Lists" page first.</p>
            <div className="modal-actions">
                <button type="button" onClick={onClose} className="modal-button cancel">
                    OK
                </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SelectFolderModal;