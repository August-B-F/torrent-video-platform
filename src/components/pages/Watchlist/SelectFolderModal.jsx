import React, { useState, useEffect } from 'react';
import './SelectFolderModal.css';

const SelectFolderModal = ({ isOpen, onClose, folders, onItemAddMultiple, itemTitle }) => {
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedFolderIds([]);
      setError('');
    }
  }, [isOpen]);

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
    if (selectedFolderIds.length === 0) {
      setError('Please select at least one list.');
      return;
    }
    onItemAddMultiple(selectedFolderIds);
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content select-folder-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add "{itemTitle}" to...</h2>
        {folders.length > 0 ? (
          <form onSubmit={handleSubmit}>
            <p className="select-folder-instruction">Select one or more lists:</p>
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
              <button type="submit" className="modal-button create" disabled={selectedFolderIds.length === 0}>
                Add to Selected ({selectedFolderIds.length})
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