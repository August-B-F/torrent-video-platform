import { BrowserRouter as Router, Routes, Route, Navigate} from 'react-router-dom';
import { useState, useEffect } from 'react';

import Login from './components/pages/Login/Login.jsx'
import SignUp from './components/pages/SignUp/SignUp.jsx';
import Home from './components/pages/Home/Home.jsx'
import Discover from './components/pages/Discover/Discover.jsx';
import ForgotPassword from './components/pages/ForgotPassword/ForgotPassword.jsx';
import Navbar from './components/pages/Navbar/Navbar.jsx'
import Watchlist from './components/pages/Watchlist/Watchlist.jsx';
import SearchResults from './components/pages/SearchResults/SearchResults.jsx';
import AddonSettings from './components/pages/AddonSettings/AddonSettings.jsx';
import SettingsPage from './components/pages/SettingsPage/SettingsPage.jsx';
import ItemDetailPage from './components/pages/ItemDetailPage/ItemDetailPage.jsx';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Default to false, check token
  const [isSearching, setIsSearching] = useState(false); // Managed by Navbar interactions
  const [selectedIcon, setSelectedIcon] = useState("home"); // Default selected icon

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
    } else {
      // If no token and not on a public route, redirect to login
      // This logic needs to be careful not to cause redirect loops
      const publicPaths = ["/login", "/signup", "/forgot-password"];
      if (!publicPaths.includes(window.location.pathname)) {
        // navigate('/login'); // Using useNavigate hook is preferred inside components
        // For App.js, direct assignment if not in component context, or structure differently
      }
    }
    // Initial route handling (redirect to login if at root and not logged in)
    if (window.location.pathname === "/" && !localStorage.getItem("token")) {
      window.location.href = "/login"; // Or use navigate if Router context is available
    } else if (window.location.pathname === "/" && localStorage.getItem("token")) {
      window.location.href = "/home";
    }

    // Update selectedIcon based on current path when app loads/refreshes
    const path = window.location.pathname;
    if (path.startsWith("/home")) setSelectedIcon("home");
    else if (path.startsWith("/discover")) setSelectedIcon("discover");
    else if (path.startsWith("/watchlist")) setSelectedIcon("watchlist");
    else if (path.startsWith("/search")) setSelectedIcon("search"); // Or Navbar manages this

  }, []); // Run once on mount

  return (
    <Router>
        <div> {/* Using a div wrapper as you had */}
          {isLoggedIn && <Navbar 
            setIsLoggedIn={setIsLoggedIn} 
            isSearching={isSearching} /* Pass isSearching for Navbar to know context */
            setIsSearching={setIsSearching} 
            selectedIcon={selectedIcon} 
            setSelectedIcon={setSelectedIcon} 
          />}
          <Routes>
                   {/* Public Routes */}
                   <Route path="/login" element={!isLoggedIn ? <Login setIsLoggedIn={setIsLoggedIn} /> : <Navigate to="/home" replace />} />
            <Route path="/signup" element={!isLoggedIn ? <SignUp /> : <Navigate to="/home" replace />} />
            <Route path="/forgot-password" element={!isLoggedIn ? <ForgotPassword /> : <Navigate to="/home" replace />} />

            {/* Protected Routes */}
            {isLoggedIn ? (
              <>
                <Route path="/home" element={<Home />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/:type/:id" element={<ItemDetailPage />} />
                
                {/* Settings Routes */}
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/addons" element={<SettingsPage />} /> {/* SettingsPage will render AddonSettings */}
                <Route path="/settings/appearance" element={<SettingsPage />} /> {/* SettingsPage will render Appearance placeholder */}


                {/* Redirect from root to /home if logged in */}
                <Route path="/" element={<Navigate to="/home" replace />} />
                {/* Optional: A 404 component for logged-in users */}
                {/* <Route path="*" element={<NotFoundLoggedIn />} /> */}
              </>
            ) : (
              // If not logged in, all paths except public ones redirect to login
              <Route path="*" element={<Navigate to="/login" replace />} />
            )}
          </Routes>
        </div>
    </Router>
  );
};

export default App;