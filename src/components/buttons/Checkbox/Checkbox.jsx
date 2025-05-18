import React, { useState } from "react";
import "./CheckboxStyle.css";

const Checkbox = ({ width, height }) => {
  const [isChecked, setIsChecked] = useState(false);

  const handleCheckboxChange = () => {
    setIsChecked(!isChecked);
  };

  const checkboxStyle = {
    backgroundColor: isChecked ? "var(--primary-color)" : "transparent",
  };

  const checkboxContainerStyle = {
    border: isChecked
      ? "2px solid var(--primary-color)"
      : "2px solid var(--secondary-text-color)",
  };

  return (
    <div
      className="checkbox-container"
      onClick={handleCheckboxChange}
      style={{ width: width, height: height, ...checkboxContainerStyle }}
    >
      <div className="checkbox" style={checkboxStyle}></div>
    </div>
  );
};

export default Checkbox;
