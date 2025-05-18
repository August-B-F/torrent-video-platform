import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';

export const PopupContext = createContext({
  popup: { message: '', type: 'info', visible: false },
  showPopup: (message, type, duration) => {},
  hidePopup: () => {},
});

export const PopupProvider = ({ children }) => {
  const [popup, setPopup] = useState({ message: '', type: 'info', visible: false });
  const timeoutIdRef = useRef(null); // Use ref to store timeout ID

  const hidePopup = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    setPopup(prev => ({ ...prev, visible: false }));
  }, []);

  const showPopup = useCallback((message, type = 'info', duration = 4000) => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    setPopup({ message, type, visible: true });
    timeoutIdRef.current = setTimeout(() => {
      hidePopup();
    }, duration);
  }, [hidePopup]);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  return (
    <PopupContext.Provider value={{ popup, showPopup, hidePopup }}>
      {children}
    </PopupContext.Provider>
  );
};

export const usePopup = () => useContext(PopupContext);