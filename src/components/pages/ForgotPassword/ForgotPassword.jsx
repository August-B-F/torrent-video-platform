import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./ForgotPasswordStyle.css"; // We'll create this CSS file

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [infoPopupMessage, setInfoPopupMessage] = useState("");
  const [infoPopupTheme, setInfoPopupTheme] = useState("info"); // 'info' or 'warning'
  const [showPopup, setShowPopup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (showPopup) {
      timer = setTimeout(() => {
        setShowPopup(false);
      }, 5000); // Longer display for confirmation messages
    }
    return () => clearTimeout(timer);
  }, [showPopup]);

  const displayPopup = (message, theme) => {
    setInfoPopupMessage(message);
    setInfoPopupTheme(theme);
    setShowPopup(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setShowPopup(false);

    if (email === "") {
      displayPopup("Please enter your email address.", "warning");
      setIsLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      displayPopup("Invalid email format.", "warning");
      setIsLoading(false);
      return;
    }

    try {
      // Simulate API call
      // Replace with your actual API endpoint:
      // const response = await fetch("/api/forgot-password", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email }),
      // });

      // if (response.ok) {
      //   displayPopup("If an account with this email exists, a password reset link has been sent.", "info");
      // } else {
      //   // Even on error, for security reasons, you might show a generic success message
      //   // Or handle specific errors if your API provides them and it's safe to do so
      //   displayPopup("If an account with this email exists, a password reset link has been sent. Check your spam folder too.", "info");
      // }

      // --- SIMULATED RESPONSE ---
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
      console.log("Password reset requested for:", email);
      displayPopup("If an account with that email exists, we've sent instructions to reset your password. Please check your inbox (and spam folder).", "info");
      // --- END SIMULATION ---

      setEmail(""); // Clear field after submission
    } catch (error) {
      console.error("Forgot password request failed:", error);
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
      <div className="auth-form-wrapper">
        <div className="auth-header">
          <h1 className="auth-title">Forgot Password?</h1>
          <p className="auth-subtitle">No worries! Enter your email and we'll send you a reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
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
              className={showPopup && infoPopupTheme === 'warning' && (email === "" || (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ? 'input-error' : ''}
            />
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? (
              <div className="spinner-container">
                <div className="spinner"></div>
                <span>Sending...</span>
              </div>
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        <div className="alternative-action">
          <p><Link to="/login" className="highlight-link">&larr; Back to Sign In</Link></p>
        </div>
      </div>
      <footer className="auth-footer">
        <p>&copy; {new Date().getFullYear()} Your Company. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ForgotPassword;