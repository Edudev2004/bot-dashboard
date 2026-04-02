import React, { useState, useRef, useEffect } from "react";
import { 
  User, 
  LogOut, 
  Plus, 
  Check, 
  ChevronDown, 
  ShieldCheck,
  Trash2,
  AlertTriangle,
  ArrowLeft
} from "lucide-react";

const UserDropdown = ({ 
  theme, 
  onLogout, 
  waDevices, 
  activeInstanceId, 
  switchInstance,
  deleteBot,
  handleAddDevice,
  userRole 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteStep, setDeleteStep] = useState(0); // 0: list, 1: warning, 2: final confirm
  const dropdownRef = useRef(null);
  const username = localStorage.getItem("username") || "Usuario";

  const resetDelete = () => {
    setDeletingId(null);
    setDeleteStep(0);
  };

  // Cerrar al hacer clic fuera y resetear estado de borrado
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        resetDelete();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeDevice = Object.entries(waDevices).find(([id]) => id === activeInstanceId)?.[1];

  return (
    <div className={`user-dropdown-container ${theme}`} ref={dropdownRef}>
      <button 
        className={`user-avatar-button ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="user-avatar-circle">
          {username.slice(0, 2).toUpperCase()}
        </div>
        <div className="user-info-mini">
          <span className="user-name-text">{username}</span>
          <span className="active-bot-text">
            {activeDevice ? `Bot: ${activeInstanceId.split("_").pop().slice(-4)}` : "Sin bot activo"}
          </span>
        </div>
        <ChevronDown size={14} className={`chevron-icon ${isOpen ? "rotate" : ""}`} />
      </button>

      {isOpen && (
        <div className="user-dropdown-menu glass-morphism">
          {deleteStep === 0 ? (
            <>
              <div className="dropdown-header">
                <div className="header-user-info">
                  <p className="header-username">{username}</p>
                  <p className="header-role">
                    <ShieldCheck size={12} /> {userRole === "administrator" ? "Administrador" : "Cliente"}
                  </p>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <div className="dropdown-section">
                <p className="section-title">Cambiar Dispositivo</p>
                <div className="instance-list">
                  {Object.keys(waDevices).length === 0 ? (
                    <p className="empty-instances">No hay dispositivos</p>
                  ) : (
                    Object.entries(waDevices).map(([id, dev]) => (
                      <div key={id} className={`instance-item-wrapper ${id === activeInstanceId ? "selected" : ""}`}>
                        <button 
                          className="instance-item-btn"
                          onClick={() => {
                            switchInstance(id);
                            setIsOpen(false);
                          }}
                        >
                          <div className="instance-item-left">
                            <div className={`status-dot ${dev.connected ? "online" : "offline"}`}></div>
                            <span className="instance-name">
                              Bot #{id.split("_").pop().slice(-4)}
                            </span>
                          </div>
                          {id === activeInstanceId && <Check size={14} className="check-icon" />}
                        </button>
                        <button 
                          className="trash-btn" 
                          title="Eliminar Bot"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(id);
                            setDeleteStep(1);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <button className="add-instance-btn" onClick={() => { handleAddDevice(); setIsOpen(false); }}>
                  <Plus size={14} /> Vincular otro
                </button>
              </div>

              <div className="dropdown-divider"></div>

              <div className="dropdown-actions">
                <button className="dropdown-action-item">
                  <User size={16} /> Ver Perfil
                </button>
                <button className="dropdown-action-item logout" onClick={onLogout}>
                  <LogOut size={16} /> Cerrar Sesión
                </button>
              </div>
            </>
          ) : (
            <div className="delete-flow-container">
              <button className="back-btn" onClick={resetDelete}>
                <ArrowLeft size={14} /> Volver
              </button>
              
              {deleteStep === 1 ? (
                <div className="delete-step-panel step-1">
                  <div className="warning-icon-wrap">
                    <AlertTriangle size={32} />
                  </div>
                  <h3>¿Eliminar Bot #{deletingId.split("_").pop().slice(-4)}?</h3>
                  <p>Esta acción borrará <strong>permanentemente</strong> todos los nodos, configuración e historial de este bot.</p>
                  <button className="delete-next-btn" onClick={() => setDeleteStep(2)}>
                    Entendido, continuar
                  </button>
                </div>
              ) : (
                <div className="delete-step-panel step-2">
                  <div className="danger-icon-wrap">
                    <Trash2 size={32} />
                  </div>
                  <h3>Seguridad Final</h3>
                  <p>¿Estás totalmente seguro? Esta acción no se puede deshacer.</p>
                  <button className="delete-confirm-btn" onClick={() => {
                    deleteBot(deletingId);
                    setIsOpen(false);
                    resetDelete();
                  }}>
                    Sí, borrar para siempre
                  </button>
                  <button className="delete-cancel-btn" onClick={resetDelete}>
                    No, mantener bot
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
