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
import MediaPlayerPage from './components/pages/MediaPlayerPage/MediaPlayerPage.jsx'; // <-- IMPORT NEW PAGE

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
    else if (path.startsWith("/watchlist")) setSelectedIcon("watchlist");
    else if (path.startsWith("/search")) setSelectedIcon("search");
    else if (path.startsWith("/settings")) setSelectedIcon("settings");
    else if (path === "/" ) {
        if (token && window.location.pathname !== "/home") {
            window.location.href = "/home";
        } else if (!token && window.location.pathname !== "/login") {
             window.location.href = "/login";
        }
    }
    // No icon change for /play route as it's a dedicated player page
  }, []);


  return (
    <Router>
        <div>
          {/* Conditionally render Navbar based on the route */}
          {window.location.pathname !== '/play' && isLoggedIn && <Navbar
            setIsLoggedIn={setIsLoggedIn}
            isSearching={isSearching}
            setIsSearching={setIsSearching}
            selectedIcon={selectedIcon}
            setSelectedIcon={setSelectedIcon}
          />}
          {window.location.pathname !== '/play' && <InfoPopupDisplay />}
          
          <Routes>
            <Route path="/login" element={!isLoggedIn ? <Login setIsLoggedIn={setIsLoggedIn} /> : <Navigate to="/home" replace />} />
            <Route path="/signup" element={!isLoggedIn ? <SignUp /> : <Navigate to="/home" replace />} />
            <Route path="/forgot-password" element={!isLoggedIn ? <ForgotPassword /> : <Navigate to="/home" replace />} />

            <Route path="/play" element={isLoggedIn ? <MediaPlayerPage /> : <Navigate to="/login" replace />} />

            {isLoggedIn ? (
              <>
                <Route path="/home" element={<Home />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/watchlist/folder/:folderId" element={<Watchlist />} />
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

// import React, { useState } from 'react';
// import SearchPage from './SearchPage';
// import MediaPlayer from './MediaPlayer';

// const API_BASE_URL = 'https://188-245-179-212.nip.io';

// function App() {
//   const [currentView, setCurrentView] = useState('search');
//   const [streamData, setStreamData] = useState(null);
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [authError, setAuthError] = useState(null);

//   const login = async () => {
//     try {
//       setAuthError(null);
//       console.log('Attempting to login to:', API_BASE_URL);
      
//       // Try login first
//       let response = await fetch(`${API_BASE_URL}/api/login`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           username: 'testuser',
//           password: 'testpass'
//         })
//       });

//       if (response.ok) {
//         const data = await response.json();
//         localStorage.setItem('token', data.token);
//         setIsAuthenticated(true);
//         console.log('Login successful');
//         return;
//       }

//       console.log('Login failed, trying to register...');
      
//       // Try registering if login fails
//       response = await fetch(`${API_BASE_URL}/api/register`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           username: 'testuser',
//           password: 'testpass'
//         })
//       });

//       if (response.ok) {
//         const data = await response.json();
//         localStorage.setItem('token', data.token);
//         setIsAuthenticated(true);
//         console.log('Registration successful');
//       } else {
//         const errorText = await response.text();
//         throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
//       }
//     } catch (error) {
//       console.error('Auth error:', error);
//       setAuthError(error.message);
//     }
//   };

//   const startStream = async (magnetLink, movieTitle) => {
//     setLoading(true);
//     try {
//       console.log('Starting stream for:', movieTitle);
      
//       const response = await fetch(`${API_BASE_URL}/api/stream`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${localStorage.getItem('token')}`
//         },
//         body: JSON.stringify({ magnetLink, movieTitle })
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(`Failed to start stream: ${response.status} - ${errorText}`);
//       }

//       const data = await response.json();
//       setStreamData(data);
//       setCurrentView('player');
//       console.log('Stream started successfully');
//     } catch (error) {
//       console.error('Stream error:', error);
//       alert('Failed to start stream: ' + error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const goBackToSearch = () => {
//     setCurrentView('search');
//     setStreamData(null);
//   };

//   // Check for existing token and auto-login
//   React.useEffect(() => {
//     const token = localStorage.getItem('token');
//     if (token) {
//       setIsAuthenticated(true);
//       console.log('Using existing token');
//     } else {
//       login();
//     }
//   }, []);

//   if (!isAuthenticated) {
//     return (
//       <div className="min-h-screen bg-gray-900 flex items-center justify-center" style={{backgroundColor: "red"}}>
//         <div className="text-white text-center max-w-md">
//           <h1 className="text-2xl mb-4">Torrent Streaming Test</h1>
          
//           {authError ? (
//             <div className="bg-red-900 border border-red-700 text-red-200 p-4 rounded mb-4">
//               <p className="font-semibold">Authentication Error:</p>
//               <p className="text-sm">{authError}</p>
//             </div>
//           ) : (
//             <p className="mb-4">Authenticating...</p>
//           )}
          
//           <button 
//             onClick={login}
//             className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded"
//           >
//             {authError ? 'Retry' : 'Login / Register'}
//           </button>
          
//           <div className="mt-4 text-xs text-gray-400">
//             <p>Server: {API_BASE_URL}</p>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-900">
//       <header className="bg-gray-800 p-4">
//         <div className="container mx-auto flex justify-between items-center">
//           <h1 className="text-white text-2xl font-bold">Torrent Streaming Test</h1>
//           {currentView === 'player' && (
//             <button 
//               onClick={goBackToSearch}
//               className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
//             >
//               Back to Search
//             </button>
//           )}
//         </div>
//       </header>

//       <main className="container mx-auto p-4">
//         {loading && (
//           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//             <div className="text-white text-center">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
//               <p className="text-lg">Starting stream...</p>
//             </div>
//           </div>
//         )}

//         {currentView === 'search' ? (
//           <SearchPage onSelectTorrent={startStream} />
//         ) : (
//           <MediaPlayer 
//             streamData={streamData} 
//             onError={(error) => console.error('Player error:', error)}
//           />
//         )}
//       </main>
//     </div>
//   );
// }

// export default App;