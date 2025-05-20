import { BrowserRouter as Router, Routes, Route, Navigate} from 'react-router-dom';
import { useState, useEffect } from 'react';

// Context & Global Components
// PopupProvider will be in index.js, App is wrapped by it.
import InfoPopupDisplay from './components/common/InfoPopupDisplay/InfoPopupDisplay.jsx'; 

// Page Components
import Login from './components/pages/Login/Login.jsx'
import SignUp from './components/pages/SignUp/SignUp.jsx';
import Home from './components/pages/Home/Home.jsx'
import Discover from './components/pages/Discover/Discover.jsx';
import ForgotPassword from './components/pages/ForgotPassword/ForgotPassword.jsx';
import Navbar from './components/pages/Navbar/Navbar.jsx'
import Watchlist from './components/pages/Watchlist/Watchlist.jsx';
import SearchResults from './components/pages/SearchResults/SearchResults.jsx';
import SettingsPage from './components/pages/SettingsPage/SettingsPage.jsx';
import ItemDetailPage from './components/pages/ItemDetailPage/ItemDetailPage.jsx';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Check token on mount
  const [isSearching, setIsSearching] = useState(false); 
  const [selectedIcon, setSelectedIcon] = useState("home"); 

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
    }
    // Initial path check for icon and root redirect
    const path = window.location.pathname;
    if (path.startsWith("/home")) setSelectedIcon("home");
    else if (path.startsWith("/discover")) setSelectedIcon("discover");
    else if (path.startsWith("/watchlist")) setSelectedIcon("watchlist");
    else if (path.startsWith("/search")) setSelectedIcon("search");
    else if (path.startsWith("/settings")) setSelectedIcon("settings");
    else if (path === "/" ) {
        if (token && window.location.pathname !== "/home") { // Check to prevent loop if already at /home
            // navigate("/home", { replace: true }); // Ideal, but App.js might not have Router context directly
            window.location.href = "/home";
        } else if (!token && window.location.pathname !== "/login") { // Check to prevent loop
            // navigate("/login", { replace: true });
             window.location.href = "/login";
        }
    }
  }, []);


  return (
    // Assuming PopupProvider, AddonProvider, WatchlistProvider are in index.js wrapping <App />
    <Router>
        <div>
          {isLoggedIn && <Navbar 
            setIsLoggedIn={setIsLoggedIn} 
            isSearching={isSearching} 
            setIsSearching={setIsSearching} 
            selectedIcon={selectedIcon} 
            setSelectedIcon={setSelectedIcon} 
          />}
          <InfoPopupDisplay /> {/* Crucial: Render the popup display component */}
          <Routes>
            <Route path="/login" element={!isLoggedIn ? <Login setIsLoggedIn={setIsLoggedIn} /> : <Navigate to="/home" replace />} />
            <Route path="/signup" element={!isLoggedIn ? <SignUp /> : <Navigate to="/home" replace />} />
            <Route path="/forgot-password" element={!isLoggedIn ? <ForgotPassword /> : <Navigate to="/home" replace />} />

            {isLoggedIn ? (
              <>
                <Route path="/home" element={<Home />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/:type/:id" element={<ItemDetailPage />} />
                
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/addons" element={<SettingsPage />} /> 
                <Route path="/settings/appearance" element={<SettingsPage />} />
                <Route path="/settings/account" element={<SettingsPage />} />

                <Route path="/" element={<Navigate to="/home" replace />} /> {/* Default for logged in */}
                <Route path="*" element={<Navigate to="/home" replace />} /> {/* Catch-all for logged in */}
              </>
            ) : (
              <>
                {/* If not logged in, default to login. Specific public routes are above. */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            )}
          </Routes>
        </div>
    </Router>
  );
};

export default App;