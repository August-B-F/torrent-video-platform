import React, { useState } from 'react';
import './CreateFolderModal.css'; 

const CreateFolderModal = ({ isOpen, onClose, onCreateFolder }) => {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setError('Folder name cannot be empty.');
      return;
    }
    onCreateFolder(folderName.trim());
    setFolderName('');
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Folder</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Enter folder name"
            className="modal-input"
            autoFocus
          />
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="modal-button cancel">
              Cancel
            </button>
            <button type="submit" className="modal-button create">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFolderModal;