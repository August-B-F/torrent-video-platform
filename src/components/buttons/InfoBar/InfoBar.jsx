import React, { useState, useRef, useEffect } from "react";

import "./InfoBarStyle.css";
import Avatar from "react-avatar";

const InfoBar = ({
  Icon,
  Content,
  Text,
  bgColor,
  buttonStyle,
  contentStyle,
  dropdownTextStyle,
  flipIcon = false,
  avatar = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const dropdownContent =
      dropdownRef.current.querySelector(".dropdown-content");
    if (isOpen) {
      dropdownContent.style.opacity = "0";
      dropdownContent.style.transform = "scaleY(0)";
      dropdownContent.classList.add("show");
      setTimeout(() => {
        dropdownContent.style.opacity = "1";
        dropdownContent.style.transform = "scaleY(1)";
      }, 0);
    } else {
      dropdownContent.style.opacity = "0";
      dropdownContent.style.transform = "scaleY(0)";
      setTimeout(() => {
        dropdownContent.classList.remove("show");
      }, 300);
    }
  }, [isOpen]);

  return (
    <div
      className="dropdown"
      ref={dropdownRef}
      style={{ backgroundColor: bgColor }}
    >
      {/* if avatar isent emty put padding to 0, else keep the one as before */}
      <button
        className="dropdown-button"
        onClick={toggleDropdown}
        style={buttonStyle}
      >
        {avatar ? (
          <Avatar name={avatar} size="50px" className="avatar" />
        ) : (
          <div style={dropdownTextStyle}>
            <p style={{ fontSize: "1rem" }}>{Text}</p>
            {Icon && (
              <div>
                {flipIcon ? (
                  <img
                    src={Icon}
                    alt="icon"
                    className="dropdown-icon"
                    style={{
                      transform:
                        flipIcon && isOpen ? "rotate(0deg)" : "rotate(180deg)",
                      width: "80%",
                    }}
                  />
                ) : (
                  <img src={Icon} alt="icon" className="dropdown-icon" />
                )}
              </div>
            )}
          </div>
        )}
      </button>
      <div
        className={`dropdown-content ${isOpen ? "show" : ""}`}
        style={contentStyle}
      >
        {Content}
      </div>
    </div>
  );
};

export default InfoBar;
