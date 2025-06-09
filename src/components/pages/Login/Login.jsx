import React, { useState, useEffect } from "react";
import Checkbox from "../../buttons/Checkbox/Checkbox";
import { Link, useNavigate } from "react-router-dom"; 
import "./LoginStyle.css";

const Login = ({ setIsLoggedIn }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [infoPopupMessage, setInfoPopupMessage] = useState("");
  const [infoPopupTheme, setInfoPopupTheme] = useState("info"); 
  const [showPopup, setShowPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setShowPopup(false); 

    if (email === "" || password === "") {
      displayPopup("Please fill in all fields.", "warning");
      setIsLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      displayPopup("Invalid email format.", "warning");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      displayPopup("Password must be at least 8 characters.", "warning");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/login", { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.token);
        setIsLoggedIn(true);

        navigate("/home"); 
      } else {
        let errorMessage = "Invalid email or password.";
        try {
            const errorData = await response.json();
            if (errorData && errorData.message) {
                errorMessage = errorData.message;
            }
        } catch (e) {
            if(response.statusText) errorMessage = response.statusText;
        }
        displayPopup(errorMessage, "warning");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Login request failed:", error);
      displayPopup("An unexpected error occurred. Please try again.", "warning");
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {showPopup && (
        <div className={`info-popup ${infoPopupTheme === 'warning' ? 'warning' : 'info'} ${showPopup ? 'show' : ''}`}>
          {infoPopupMessage}
        </div>
      )}
      <div className="login-form-wrapper">
        <div className="login-header">
          <h1 className="login-title">Welcome Back!</h1>
          <p className="login-subtitle">Sign in to continue to your account.</p>
        </div>

        <form onSubmit={handleLogin} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., name@example.com"
              required
              aria-label="Email Address"
              className={showPopup && (email === "" || (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ? 'input-error' : ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              aria-label="Password"
              className={showPopup && (password === "" || (password !== "" && password.length < 8)) ? 'input-error' : ''}
            />
          </div>

          <div className="form-options">
            <Checkbox
              id="remember-me"
              label="Remember me"
              checked={rememberMe}
              onChange={() => setRememberMe(!rememberMe)}
            />
            <Link to="/forgot-password" className="auxiliary-link">Forgot Password?</Link>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <div className="spinner-container">
                <div className="spinner"></div>
                <span>Signing In...</span>
              </div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="alternative-action">
          <p>Don't have an account? <Link to="/signup" className="highlight-link">Sign Up Now</Link></p>
        </div>
      </div>
       <footer className="login-footer">
        <p>&copy; {new Date().getFullYear()} Your Company. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Login;