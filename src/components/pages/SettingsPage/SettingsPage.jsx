import React from 'react'; 
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './SettingsPage.css';
import AddonSettings from '../AddonSettings/AddonSettings';
import AppearanceSettings from '../AppearanceSettings/AppearanceSettings';
import AccountSettings from '../AccountSettings/AccountSettings'; 

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);
const AddonsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l1.88 5.77L20 9.23l-4.58 3.97L16.24 19 12 15.77 7.76 19l1.12-5.8L4 9.23l6.12-1.46L12 2zM12 2v13.77"/></svg>
);
const AppearanceIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
);

const UserAccountIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);

const SettingsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
  
    const settingCategories = [
      {
        name: 'Account',
        path: '/settings/account',
        description: 'Manage your profile, email, and password.',
        icon: <UserAccountIcon />,
        component: <AccountSettings />
      },
      {
        name: 'Manage Addons',
        path: '/settings/addons',
        description: 'Add, remove, and configure Stremio addons.',
        icon: <AddonsIcon />,
        component: <AddonSettings />
      },
      {
        name: 'Appearance',
        path: '/settings/appearance',
        description: 'Customize the look and feel of the application.',
        icon: <AppearanceIcon />,
        component: <AppearanceSettings />
      },
    ];
  
    const activeCategory = settingCategories.find(cat => location.pathname === cat.path);
  
    if (activeCategory) {
      return (
        <div className="page-container settings-subpage-container">
           <main className="page-main-content">
              <button onClick={() => navigate('/settings')} className="back-to-settings-btn">
                  &larr; Back to Settings
              </button>
              {activeCategory.component}
          </main>
        </div>
      );
    }
  
    return (
      <div className="page-container settings-hub-page">
        <main className="page-main-content">
          <h1 className="page-title">Settings</h1>
          <section className="settings-category-list">
            {settingCategories.map(category => (
              <Link to={category.path} key={category.name} className="settings-category-item">
                <div className="category-icon">{category.icon}</div>
                <div className="category-info">
                  <h2 className="category-name">{category.name}</h2>
                  <p className="category-description">{category.description}</p>
                </div>
                <div className="category-arrow"><ChevronRightIcon /></div>
              </Link>
            ))}
          </section>
        </main>
      </div>
    );
  };
  
  export default SettingsPage;