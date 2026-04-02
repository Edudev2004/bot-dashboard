import React from "react";

// eslint-disable-next-line no-unused-vars
const NavItem = ({ icon: Icon, label, active, onClick }) => {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
};

export default NavItem;
