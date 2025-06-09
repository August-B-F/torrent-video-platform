import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

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
    setIsSearching(false); 
    setIsSearchInputActive(false); 
    setSearchQuery("");
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const toggleSearchInput = () => {
    setIsSearchInputActive(prev => !prev);
  };

  useEffect(() => {
    if (isSearchInputActive && searchInputRef.current) {
      searchInputRef.current.focus();
      setIsSearching(true);
      setSelectedIcon('search'); 
    } else if (!isSearchInputActive) {
    }
  }, [isSearchInputActive, setIsSearching, setSelectedIcon]);
  
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (searchQuery.trim() === "") return;

    setIsSearching(true); 
    setSelectedIcon('search'); 
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
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
      setIsSearching(false); 
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target) && isSearchInputActive) {
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
          <form onSubmit={handleSearchSubmit} className="mobile-search-form">
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={handleSearchKeyDown} 
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