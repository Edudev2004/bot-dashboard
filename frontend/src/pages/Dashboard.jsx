import React, { useState } from "react";
import "../TreeEditor.css";
import useDashboardData from "../hooks/useDashboardData";

// Layout components
import Sidebar, { NAV_ITEMS } from "../components/dashboard/Sidebar";
import TopHeader from "../components/dashboard/TopHeader";
import QrModal from "../components/dashboard/QrModal";
import MessagesTable from "../components/dashboard/MessagesTable";

// View components
import OverviewView from "./dashboard/views/OverviewView";
import UsersView from "./dashboard/views/UsersView";
import AdminView from "./dashboard/views/AdminView";
import SettingsView from "./dashboard/views/SettingsView";
import OrdersView from "./dashboard/views/OrdersView";
import CalendarView from "./dashboard/views/CalendarView";

// Page components
import ChatbotEditor from "./ChatbotEditor";

export default function Dashboard({ theme, toggleTheme, onLogout }) {
  const [activeNav, setActiveNav] = useState("dashboard");

  const {
    // State
    messages,
    loading,
    connected,
    lastUpdate,
    waDevices,
    activeQrModalId,
    setActiveQrModalId,
    isLinking,
    allUsers,
    adminLoading,
    userId,
    userName,
    userRole,
    orders,
    ordersLoading,
    // Actions
    switchInstance,
    renameBot,
    deleteBot,
    addOrder,
    updateOrderStatus,
    deleteOrder,
    loadAdminUsers,
    toggleUserStatus,
    handleWADisconnect,
    handleAddDevice,
    // Computed
    uniqueUsers,
    trends,
    hourlyData,
    topNodesData,
    botEffectivenessData,
    retentionStats,
    activeInstanceId,
  } = useDashboardData();

  // Build full nav items list (including admin if applicable)
  const navItems = [
    ...NAV_ITEMS,
    ...(userRole === "administrator"
      ? [{ id: "admin", icon: null, label: "Admin Panel" }]
      : []),
  ];

  return (
    <div className="layout">
      {/* QR Modal overlays */}
      <QrModal
        waDevices={waDevices}
        activeQrModalId={activeQrModalId}
        setActiveQrModalId={setActiveQrModalId}
        handleWADisconnect={handleWADisconnect}
      />

      {/* Sidebar */}
      <Sidebar
        theme={theme}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onLogout={onLogout}
        userRole={userRole}
      />

      {/* Main Content */}
      <main className="main">
        <TopHeader
          activeNav={activeNav}
          navItems={navItems}
          connected={connected}
          lastUpdate={lastUpdate}
          theme={theme}
          toggleTheme={toggleTheme}
          onLogout={onLogout}
          waDevices={waDevices}
          activeInstanceId={activeInstanceId}
          switchInstance={switchInstance}
          renameBot={renameBot}
          deleteBot={deleteBot}
          handleAddDevice={handleAddDevice}
          userName={userName}
          userRole={userRole}
          setActiveQrModalId={setActiveQrModalId}
        />

        {/* ── Views ──────────────────────────────────────────── */}

        {activeNav === "dashboard" && (
          <OverviewView
            messages={messages}
            loading={loading}
            trends={trends}
            hourlyData={hourlyData}
            topNodesData={topNodesData}
            botEffectivenessData={botEffectivenessData}
            retentionStats={retentionStats}
            theme={theme}
            waDevices={waDevices}
          />
        )}

        {activeNav === "messages" && (
          <MessagesTable
            messages={messages}
            loading={loading}
            title="Historial de Mensajes"
            subtitle="Todos los registros almacenados en la base de datos"
            isDashboard={false}
            waDevices={waDevices}
          />
        )}

        {activeNav === "pedidos" && (
          <OrdersView 
            orders={orders} 
            loading={ordersLoading} 
            addOrder={addOrder} 
            updateOrderStatus={updateOrderStatus}
            deleteOrder={deleteOrder} 
          />
        )}

        {activeNav === "calendario" && (
          <CalendarView orders={orders} theme={theme} />
        )}

        {activeNav === "botconfig" && <ChatbotEditor />}

        {activeNav === "usuarios" && (
          <UsersView uniqueUsers={uniqueUsers} loading={loading} />
        )}

        {activeNav === "admin" && userRole === "administrator" && (
          <AdminView
            allUsers={allUsers}
            loading={loading}
            adminLoading={adminLoading}
            loadAdminUsers={loadAdminUsers}
            toggleUserStatus={toggleUserStatus}
          />
        )}

        {activeNav === "settings" && (
          <SettingsView
            waDevices={waDevices}
            isLinking={isLinking}
            handleAddDevice={handleAddDevice}
            handleWADisconnect={handleWADisconnect}
            setActiveQrModalId={setActiveQrModalId}
            userId={userId}
          />
        )}
      </main>
    </div>
  );
}
