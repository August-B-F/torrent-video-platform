import React, { useState, useEffect, useCallback } from 'react';
import { useWatchlist } from '../../contexts/WatchlistContext'; 
import './SelectFolderModal.css';

const SelectFolderModal = ({ isOpen, onClose, folders: allFoldersFromContext, onItemAddMultiple, itemTitle, itemId, itemType }) => {
  const { addItemToFolders, removeItemFromFolder, isItemInFolder } = useWatchlist();
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [initialFolderIds, setInitialFolderIds] = useState([]); 
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && itemId && allFoldersFromContext.length > 0) {
      const idsContainingItem = allFoldersFromContext
        .filter(folder => folder.items.some(item => item.id === itemId))
        .map(folder => folder.id);
      setSelectedFolderIds(idsContainingItem);
      setInitialFolderIds(idsContainingItem); 
      setError('');
    } else if (!isOpen) {
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

    const foldersToAdd = selectedFolderIds.filter(id => !initialFolderIds.includes(id));
    const foldersToRemove = initialFolderIds.filter(id => !selectedFolderIds.includes(id));

    let operationsSuccessful = true;

    if (foldersToAdd.length > 0) {
      await addItemToFolders(itemId, itemType, foldersToAdd);
    }

    for (const folderId of foldersToRemove) {
      await removeItemFromFolder(folderId, itemId);
    }
   
    if (typeof onItemAddMultiple === 'function' && (foldersToAdd.length > 0 || foldersToRemove.length > 0) ) {
      onItemAddMultiple(selectedFolderIds);
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