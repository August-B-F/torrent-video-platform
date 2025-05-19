import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';

export const PopupContext = createContext({
  popup: { message: '', type: 'info', visible: false, duration: 4000 },
  showPopup: (message, type, duration) => {},
  hidePopup: () => {},
});

export const PopupProvider = ({ children }) => {
  const [popup, setPopup] = useState({ message: '', type: 'info', visible: false, duration: 4000 });
  const timeoutIdRef = useRef(null);

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
    setPopup({ message, type, visible: true, duration });
    timeoutIdRef.current = setTimeout(() => {
      hidePopup();
    }, duration);
  }, [hidePopup]);

  useEffect(() => {
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