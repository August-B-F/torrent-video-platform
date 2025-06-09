import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./SignUpStyle.css"; 

const SignUp = ({ setIsLoggedIn }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [infoPopupMessage, setInfoPopupMessage] = useState("");
  const [infoPopupTheme, setInfoPopupTheme] = useState("info");
  const [showPopup, setShowPopup] = useState(false);
  
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (showPopup) {
      timer = setTimeout(() => {
        setShowPopup(false);
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [showPopup]);

  const displayPopup = (message, theme) => {
    setInfoPopupMessage(message);
    setInfoPopupTheme(theme);
    setShowPopup(true);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!fullName.trim()) newErrors.fullName = "Full name is required.";
    
    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const handleSubmit = async (event) => {
    event.preventDefault();
    setShowPopup(false);
    setErrors({}); 

    if (!validateForm()) {
        displayPopup("Please correct the errors in the form.", "warning");
        return;
    }

    setIsLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); 
      console.log("Sign up attempt:", { fullName, email, password });
      
      if (email === "taken@example.com") {
          displayPopup("This email address is already registered.", "warning");
          setErrors({ email: "This email address is already registered." });
      } else {
          displayPopup("Sign up successful! Please check your email to verify your account (optional step). Redirecting to login...", "info");
          setTimeout(() => navigate("/login"), 3000);
      }

    } catch (error) {
      console.error("Sign up request failed:", error);
      displayPopup("An unexpected error occurred. Please try again.", "warning");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      {showPopup && (
        <div className={`info-popup ${infoPopupTheme === 'warning' ? 'warning' : 'info'} ${showPopup ? 'show' : ''}`}>
          {infoPopupMessage}
        </div>
      )}
      <div className="auth-form-wrapper signup-wrapper"> 
        <div className="auth-header">
          <h1 className="auth-title">Create Your Account</h1>
          <p className="auth-subtitle">Join our community today!</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Alex Smith"
              required
              aria-label="Full Name"
              className={errors.fullName ? 'input-error' : ''}
            />
            {errors.fullName && <p className="error-message">{errors.fullName}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              aria-label="Email Address"
              className={errors.email ? 'input-error' : ''}
            />
            {errors.email && <p className="error-message">{errors.email}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              aria-label="Password"
              className={errors.password ? 'input-error' : ''}
            />
             {errors.password && <p className="error-message">{errors.password}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              aria-label="Confirm Password"
              className={errors.confirmPassword ? 'input-error' : ''}
            />
            {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? (
              <div className="spinner-container">
                <div className="spinner"></div>
                <span>Creating Account...</span>
              </div>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="alternative-action">
          <p>Already have an account? <Link to="/login" className="highlight-link">Sign In</Link></p>
        </div>
      </div>
       <footer className="auth-footer">
        <p>&copy; {new Date().getFullYear()} Your Company. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default SignUp;