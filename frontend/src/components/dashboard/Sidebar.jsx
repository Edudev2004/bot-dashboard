import React from "react";
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  Users,
  Bot,
  Settings,
  LogOut,
  UserCheck,
} from "lucide-react";
import NavItem from "./NavItem";
import arboraBlack from "../../assets/ARBORA-BLACK.png";
import arboraWhite from "../../assets/ARBORA-WHITE.png";

const NAV_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "messages", icon: MessageSquare, label: "Mensajes" },
  { id: "pedidos", icon: ShoppingCart, label: "Pedidos" },
  { id: "botconfig", icon: Bot, label: "Bot Config" },
  { id: "usuarios", icon: Users, label: "Usuarios" },
];

const Sidebar = ({ theme, activeNav, setActiveNav, onLogout, userRole }) => {
  const navItems = [
    ...NAV_ITEMS,
    ...(userRole === "administrator"
      ? [{ id: "admin", icon: UserCheck, label: "Admin Panel" }]
      : []),
  ];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img
          src={theme === "dark" ? arboraWhite : arboraBlack}
          alt="Arbora Logo"
          className="logo-image"
        />
      </div>

      {/* Navegación principal */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeNav === item.id}
            onClick={() => setActiveNav(item.id)}
          />
        ))}
      </nav>

      {/* Separador + configuración */}
      <div className="sidebar-bottom">
        <NavItem
          icon={Settings}
          label="Configuración"
          active={activeNav === "settings"}
          onClick={() => setActiveNav("settings")}
        />
        <NavItem
          icon={LogOut}
          label="Salir"
          active={false}
          onClick={() => {
            if (window.confirm("¿Deseas cerrar la sesión?")) onLogout();
          }}
        />
      </div>
    </aside>
  );
};

// Export both the component and nav items for use by TopHeader
export { NAV_ITEMS };
export default Sidebar;
