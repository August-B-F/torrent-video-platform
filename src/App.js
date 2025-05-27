// src/App.js
import { BrowserRouter as Router, Routes, Route, Navigate} from 'react-router-dom';
import { useState, useEffect } from 'react';

// Context & Global Components
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
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState("home");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
    }
    const path = window.location.pathname;
    if (path.startsWith("/home")) setSelectedIcon("home");
    else if (path.startsWith("/discover")) setSelectedIcon("discover");
    // MODIFICATION: Update Watchlist icon logic
    else if (path.startsWith("/watchlist")) setSelectedIcon("watchlist");
    // MODIFICATION END
    else if (path.startsWith("/search")) setSelectedIcon("search");
    else if (path.startsWith("/settings")) setSelectedIcon("settings");
    else if (path === "/" ) {
        if (token && window.location.pathname !== "/home") {
            window.location.href = "/home";
        } else if (!token && window.location.pathname !== "/login") {
             window.location.href = "/login";
        }
    }
  }, []);


  return (
    <Router>
        <div>
          {isLoggedIn && <Navbar
            setIsLoggedIn={setIsLoggedIn}
            isSearching={isSearching}
            setIsSearching={setIsSearching}
            selectedIcon={selectedIcon}
            setSelectedIcon={setSelectedIcon}
          />}
          <InfoPopupDisplay />
          <Routes>
            <Route path="/login" element={!isLoggedIn ? <Login setIsLoggedIn={setIsLoggedIn} /> : <Navigate to="/home" replace />} />
            <Route path="/signup" element={!isLoggedIn ? <SignUp /> : <Navigate to="/home" replace />} />
            <Route path="/forgot-password" element={!isLoggedIn ? <ForgotPassword /> : <Navigate to="/home" replace />} />

            {isLoggedIn ? (
              <>
                <Route path="/home" element={<Home />} />
                {/* MODIFICATION START: Add routes for watchlist and specific folders */}
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/watchlist/folder/:folderId" element={<Watchlist />} />
                {/* MODIFICATION END */}
                <Route path="/search" element={<SearchResults />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/:type/:id" element={<ItemDetailPage />} />

                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/addons" element={<SettingsPage />} />
                <Route path="/settings/appearance" element={<SettingsPage />} />
                <Route path="/settings/account" element={<SettingsPage />} />

                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </>
            ) : (
              <>
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