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
  ArrowLeft,
  Edit2,
  X,
  QrCode
} from "lucide-react";

const UserDropdown = ({ 
  theme, 
  onLogout, 
  waDevices, 
  activeInstanceId, 
  switchInstance,
  renameBot,
  deleteBot,
  handleAddDevice,
  username,
  userRole,
  setActiveQrModalId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteStep, setDeleteStep] = useState(0); // 0: list, 1: warning, 2: final confirm
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState("");
  
  const dropdownRef = useRef(null);

  const resetDelete = () => {
    setDeletingId(null);
    setDeleteStep(0);
  };

  const resetEdit = () => {
    setEditingId(null);
    setTempName("");
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        resetDelete();
        resetEdit();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeDevice = Object.entries(waDevices).find(([id]) => id === activeInstanceId)?.[1];

  const handleSaveRename = (e, id) => {
    e.stopPropagation();
    if (tempName.trim()) {
      renameBot(id, tempName.trim());
    }
    resetEdit();
  };

  const startRename = (e, id, currentName) => {
    e.stopPropagation();
    setEditingId(id);
    setTempName(currentName);
  };

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
            {activeDevice ? activeDevice.name : "Sin bot activo"}
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
                <p className="section-title">Mis Bots (Dispositivos)</p>
                <div className="instance-list">
                  {Object.keys(waDevices).length === 0 ? (
                    <p className="empty-instances">No hay dispositivos</p>
                  ) : (
                    Object.entries(waDevices).map(([id, dev]) => (
                      <div key={id} className={`instance-item-wrapper ${id === activeInstanceId ? "selected" : ""}`}>
                        <div className="instance-main-row">
                          {editingId === id ? (
                            <div className="rename-input-wrap">
                              <input 
                                type="text" 
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveRename(e, id);
                                  if (e.key === "Escape") resetEdit();
                                }}
                                className="rename-input"
                              />
                              <button onClick={(e) => handleSaveRename(e, id)} className="rename-confirm-btn">
                                <Check size={14} />
                              </button>
                              <button onClick={resetEdit} className="rename-cancel-btn">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              className="instance-item-btn"
                              onClick={() => {
                                switchInstance(id);
                                setIsOpen(false);
                              }}
                            >
                              <div className="instance-item-left">
                                <div className={`status-dot ${dev.connected ? "online" : "offline"}`}></div>
                                <span className="instance-name">{dev.name}</span>
                              </div>
                              {id === activeInstanceId && <Check size={14} className="check-icon" />}
                            </button>
                          )}
                          
                          <div className="instance-actions">
                            {!dev.connected && dev.qr && (
                              <button 
                                className="qr-view-btn" 
                                title="Ver código QR"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveQrModalId(id);
                                  setIsOpen(false);
                                }}
                              >
                                <QrCode size={12} />
                              </button>
                            )}
                            {editingId !== id && (
                              <button 
                                className="edit-name-btn" 
                                title="Renombrar Bot"
                                onClick={(e) => startRename(e, id, dev.name)}
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                            <button 
                              className="trash-btn" 
                              title="Eliminar Bot"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(id);
                                setDeleteStep(1);
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
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
                  <h3>¿Eliminar "{waDevices[deletingId]?.name}"?</h3>
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
