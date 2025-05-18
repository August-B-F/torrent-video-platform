import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

// --- SVG Icons (Ensure these are defined or imported correctly) ---
const SearchIcon = ({ strokeWidth = 2 }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const UserIcon = ({ strokeWidth = 2 }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);


const Navbar = ({ setIsLoggedIn, setIsSearching, selectedIcon, setSelectedIcon }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  
  const [isSearchInputActive, setIsSearchInputActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();
  const profileRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);


  const handleNavLinkClick = (iconName, path) => {
    setSelectedIcon(iconName);
    setIsSearching(false); // Ensure global search mode is off
    setIsSearchInputActive(false); // Collapse search input
    setSearchQuery("");
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const toggleSearchInput = () => {
    setIsSearchInputActive(prev => !prev);
  };

  // Focus input when it becomes active
  useEffect(() => {
    if (isSearchInputActive && searchInputRef.current) {
      searchInputRef.current.focus();
      setIsSearching(true); // Notify App.js that search UI is active
      setSelectedIcon('search'); // Visually indicate search icon might be "active"
    } else if (!isSearchInputActive) {
        // Only turn off global searching if not triggered by submitting a search
        // This part might need refinement based on desired UX when search closes
    }
  }, [isSearchInputActive, setIsSearching, setSelectedIcon]);
  
  const handleSearchSubmit = (event) => {
    event.preventDefault(); // Prevent form submission if it's in a form
    if (searchQuery.trim() === "") return;

    setIsSearching(true); // Ensure global search mode is on
    setSelectedIcon('search'); // Keep search icon "active"
    // isSearchInputActive will remain true, input stays visible with the query
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    // Optional: Keep mobile menu closed if search submitted from there
    setIsMobileMenuOpen(false); 
  };

  const handleSearchInputChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSearchSubmit(event);
    } else if (event.key === 'Escape') {
      setIsSearchInputActive(false);
      setSearchQuery("");
      setIsSearching(false); // Turn off global search mode
      // Revert to home if escape is pressed and current icon is search due to active input
      if (selectedIcon === 'search') setSelectedIcon('home');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setIsProfileDropdownOpen(false);
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target) && isSearchInputActive) {
        // Only close if not submitting, which is hard to detect here.
        // A simpler UX might be to not close on outside click or use a dedicated close button.
        // For now, let's keep it simple: if search is active and click outside, close it.
        // However, this could be annoying if user clicks something else intentionally.
        // A more robust solution might involve checking if the click was on a search result item etc.
        // Keeping it simple for now:
        // setIsSearchInputActive(false);
        // setIsSearching(false);
        // if (selectedIcon === 'search') setSelectedIcon('home');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchInputActive, selectedIcon, setSelectedIcon, setIsSearching]);


  const navItems = [
    { name: 'Home', icon: 'home', path: '/home' },
    { name: 'Discover', icon: 'discover', path: '/discover' },
    { name: 'Watch-list', icon: 'watchlist', path: '/watchlist' }
  ];

  return (
    <nav className="app-navbar">
      <div className="navbar-left">
        <div className="navbar-links-desktop">
          {navItems.map(item => (
            <Link
              key={item.icon}
              to={item.path}
              className={`navbar-link ${selectedIcon === item.icon && !isSearchInputActive ? 'active' : ''}`}
              onClick={() => handleNavLinkClick(item.icon, item.path)}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="navbar-right">
        <div ref={searchContainerRef} className={`navbar-search-container ${isSearchInputActive ? 'active' : ''}`}>
          <button
            className={`navbar-icon-button search-icon-btn ${isSearchInputActive || (selectedIcon === 'search' && window.location.pathname.startsWith('/search')) ? 'active' : ''}`}
            onClick={toggleSearchInput}
            aria-label="Search"
          >
            <SearchIcon />
          </button>
          {isSearchInputActive && (
            <form onSubmit={handleSearchSubmit} className="search-input-form">
              <input
                ref={searchInputRef}
                type="text"
                className="search-input-field"
                placeholder="Search"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyDown={handleSearchKeyDown}
              />
            </form>
          )}
        </div>

        <div className="navbar-profile-container" ref={profileRef}>
          <button 
            className="navbar-icon-button profile-icon" 
            onClick={() => setIsProfileDropdownOpen(prev => !prev)}
            aria-label="User profile"
          >
            <UserIcon />
          </button>
          {isProfileDropdownOpen && (
            <div className="profile-dropdown">
              <Link to="/settings" onClick={() => setIsProfileDropdownOpen(false)}>Settings</Link>
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
        <button className="navbar-mobile-menu-button" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu">
          {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className={`navbar-mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
          {/* Mobile search bar - simpler version, could also use the expanding one */}
          <form onSubmit={handleSearchSubmit} className="mobile-search-form">
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={handleSearchKeyDown} // Allows Esc to close
              className="mobile-search-input"
            />
            <button type="submit" className="mobile-search-submit-btn">
              <SearchIcon strokeWidth={2.5}/>
            </button>
          </form>

          {navItems.map(item => (
            <Link
              key={item.icon}
              to={item.path}
              className={`navbar-mobile-link ${selectedIcon === item.icon ? 'active' : ''}`}
              onClick={() => handleNavLinkClick(item.icon, item.path)}
            >
              {item.name}
            </Link>
          ))}
          <hr className="mobile-menu-divider" />
          <button 
            className="navbar-mobile-link" 
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;