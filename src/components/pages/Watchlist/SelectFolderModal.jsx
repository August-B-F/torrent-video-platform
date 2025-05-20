import React, { useState, useEffect } from 'react';
import './SelectFolderModal.css';

const SelectFolderModal = ({ isOpen, onClose, folders, onItemAddMultiple, itemTitle, itemCurrentlyInFolders = [] }) => {
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Pre-select folders the item is already in
      setSelectedFolderIds(itemCurrentlyInFolders);
      setError('');
    }
  }, [isOpen, itemCurrentlyInFolders]);

  if (!isOpen) return null;

  const handleCheckboxChange = (folderId) => {
    setSelectedFolderIds(prevSelected =>
      prevSelected.includes(folderId)
        ? prevSelected.filter(id => id !== folderId)
        : [...prevSelected, folderId]
    );
    if (error) setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // No need to check for empty selection here, as it might mean unselecting from all
    // The context function will handle the logic of adding/removing
    onItemAddMultiple(selectedFolderIds); // This will now pass the final list of selected folder IDs
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content select-folder-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Manage "{itemTitle}" in Lists</h2>
        {folders.length > 0 ? (
          <form onSubmit={handleSubmit}>
            <p className="select-folder-instruction">Select lists to include this item:</p>
            <div className="folder-selection-list">
              {folders.map(folder => (
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
                Update Lists
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