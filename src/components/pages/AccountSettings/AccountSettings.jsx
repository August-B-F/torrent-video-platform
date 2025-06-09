import React, { useState, useEffect } from 'react';
import { usePopup } from '../../contexts/PopupContext'; 
import './AccountSettings.css';

const UserCircleIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>;
const MailIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></svg>;
const LockIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"></path></svg>;
const TrashIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>;

const AccountSettings = () => {
  const { showPopup } = usePopup();

  const [userData, setUserData] = useState({
    username: 'CurrentUser',
    email: 'user@example.com', 
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // const storedEmail = localStorage.getItem('userEmail'); 
    // if (storedEmail) {
    //   setUserData(prev => ({ ...prev, email: storedEmail }));
    // }
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!userData.email.trim()) newErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      newErrors.email = "Invalid email format.";
    }

    if (newPassword || currentPassword) { 
      if (!currentPassword) newErrors.currentPassword = "Current password is required to change password.";
      if (!newPassword) newErrors.newPassword = "New password is required.";
      else if (newPassword.length < 8) newErrors.newPassword = "New password must be at least 8 characters.";
      if (newPassword !== confirmNewPassword) newErrors.confirmNewPassword = "New passwords do not match.";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
        showPopup("Please correct the errors in the form.", "warning");
        return;
    }
    
    setIsLoading(true);
    showPopup("Saving changes...", "info", 2000); // Simulate loading

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Placeholder logic for updating user data
    const updatePayload = { email: userData.email };
    if (newPassword) {
      updatePayload.password = newPassword; 
    }
    console.log("Updating account with:", updatePayload);


    setIsLoading(false);
    // On success:
    showPopup("Account settings updated successfully!", "success");
    // Clear password fields after successful update
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setErrors({});

    // showPopup("Failed to update settings. Please try again.", "warning");
    // setErrors({ api: "API error message" });
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      setIsLoading(true);
      showPopup("Deleting account...", "warning", 3000);
      // Simulate API call for deletion
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("Account deletion requested for:", userData.email);
      setIsLoading(false);
      showPopup("Account deleted successfully. You will be logged out.", "info");
 
      console.log("User would be logged out and redirected now.");
    }
  };

  return (
    <div className="account-settings-content">
      <h2 className="settings-section-title main-settings-title">Account Information</h2>
      <p className="settings-section-description">
        Manage your account details and password.
      </p>

      <form onSubmit={handleSaveChanges} className="settings-form">
        <div className="setting-item-group profile-details-group">
            <h3 className="setting-item-group-title">Profile</h3>
            <div className="form-group">
                <label htmlFor="username"><UserCircleIcon /> Username</label>
                <input
                type="text"
                id="username"
                value={userData.username}
                readOnly
                className="form-input readonly-input" 
                />
                 <p className="input-description">Username cannot be changed.</p>
            </div>
            <div className="form-group">
                <label htmlFor="email"><MailIcon /> Email Address</label>
                <input
                type="email"
                id="email"
                value={userData.email}
                readOnly
                placeholder="your.email@example.com"
                className="form-input readonly-input"
                />
                <p className="input-description">Email cannot be changed.</p>
            </div>
        </div>

        <div className="setting-item-group password-change-group">
          <h3 className="setting-item-group-title">Change Password</h3>
          <div className="form-group">
            <label htmlFor="currentPassword"><LockIcon /> Current Password</label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className={`form-input ${errors.currentPassword ? 'input-error' : ''}`}
            />
             {errors.currentPassword && <p className="error-text">{errors.currentPassword}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="newPassword"><LockIcon /> New Password</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className={`form-input ${errors.newPassword ? 'input-error' : ''}`}
            />
            {errors.newPassword && <p className="error-text">{errors.newPassword}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="confirmNewPassword"><LockIcon /> Confirm New Password</label>
            <input
              type="password"
              id="confirmNewPassword"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Re-enter new password"
              className={`form-input ${errors.confirmNewPassword ? 'input-error' : ''}`}
            />
            {errors.confirmNewPassword && <p className="error-text">{errors.confirmNewPassword}</p>}
          </div>
        <div className="settings-actions">
            <button type="submit" className="settings-button primary" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
        </div>

      </form>
      
      <div className="setting-item-group delete-account-group">
        <h3 className="setting-item-group-title danger-zone-title">Danger Zone</h3>
        <div className="danger-zone-content">
            <p>Deleting your account is permanent and cannot be undone. All your data will be removed.</p>
            <button onClick={handleDeleteAccount} className="settings-button danger" disabled={isLoading}>
                <TrashIcon /> Delete My Account
            </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;