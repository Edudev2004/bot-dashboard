import React from "react";
import { Wifi, WifiOff, RefreshCw, Sun, Moon } from "lucide-react";

const TopHeader = ({
  activeNav,
  navItems,
  connected,
  lastUpdate,
  theme,
  toggleTheme,
}) => {
  return (
    <header className="top-header">
      <div className="header-left">
        <h1 className="page-title">
          {navItems.find((n) => n.id === activeNav)?.label || "Dashboard"}
        </h1>
        <span className="page-subtitle">
          {new Date().toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="header-right">
        {/* Indicador de conexión en vivo */}
        <div className={`connection-badge ${connected ? "on" : "off"}`}>
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{connected ? "En vivo" : "Sin conexión"}</span>
        </div>

        {/* Última actualización */}
        {lastUpdate && (
          <div className="last-update-badge">
            <RefreshCw size={12} />
            <span>{lastUpdate}</span>
          </div>
        )}

        {/* Toggle de tema */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title="Cambiar tema"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Avatar de usuario */}
        <div className="user-avatar" title="Sesión de Usuario">
          BD
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
