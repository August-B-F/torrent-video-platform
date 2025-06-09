import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupProvider } from './components/contexts/PopupContext.jsx' 
import './index.css';
import App from './App';

import { AddonProvider } from './components/contexts/AddonContext.jsx';
import { WatchlistProvider } from './components/contexts/WatchlistContext.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <PopupProvider> 
      <AddonProvider>
        <WatchlistProvider> 
          <App />
        </WatchlistProvider>
      </AddonProvider>
    </PopupProvider>
  </React.StrictMode>
);