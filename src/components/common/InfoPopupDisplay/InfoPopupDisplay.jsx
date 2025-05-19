import React from 'react';
import { usePopup } from '../../contexts/PopupContext';
import './InfoPopupDisplay.css';

const InfoPopupDisplay = () => {
  const { popup, hidePopup } = usePopup();

  if (!popup.visible) {
    return null;
  }

  return (
    <div className={`info-popup-banner ${popup.type} ${popup.visible ? 'show' : ''}`}>
      <span>{popup.message}</span>
      <button onClick={hidePopup} className="info-popup-close-btn" aria-label="Close popup">&times;</button>
    </div>
  );
};

export default InfoPopupDisplay;