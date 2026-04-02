import React from "react";
import { MessageCircle, RefreshCw, Plus } from "lucide-react";
import socket from "../../../services/socket";

const SettingsView = ({
  waDevices,
  isLinking,
  handleAddDevice,
  handleWADisconnect,
  setActiveQrModalId,
  userId,
}) => {
  return (
    <div className="settings-container">
      <div className="card settings-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Instancias de WhatsApp</h3>
            <p className="card-subtitle">
              Crea y gestiona múltiples conexiones simultáneas
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAddDevice}
            disabled={isLinking}
          >
            {isLinking ? (
              <>
                <RefreshCw size={16} className="spin" /> Iniciando...
              </>
            ) : (
              <>
                <Plus size={16} /> Vincular nuevo número
              </>
            )}
          </button>
        </div>

        <div className="devices-grid">
          {Object.keys(waDevices).length === 0 ? (
            <div className="table-empty" style={{ padding: "40px 0" }}>
              <MessageCircle size={40} color="var(--text-muted)" />
              <p>No hay dispositivos vinculados actualmente</p>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleAddDevice}
                style={{ marginTop: 12 }}
              >
                Configurar primera instancia
              </button>
            </div>
          ) : (
            Object.entries(waDevices).map(([id, dev]) => (
              <div
                key={id}
                className={`device-item ${dev.connected ? "active" : ""}`}
              >
                <div className="device-info">
                  <div
                    className={`device-icon ${dev.connected ? "online" : "offline"}`}
                  >
                    <MessageCircle size={20} />
                  </div>
                  <div className="device-details">
                    <h4>WhatsApp #{id.split("_").pop().slice(-4)}</h4>
                    <p>
                      {dev.connected
                        ? "Conectado y Operativo"
                        : dev.message || "Esperando vinculación"}
                    </p>
                  </div>
                </div>
                <div className="device-actions">
                  {dev.connected ? (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleWADisconnect(id)}
                    >
                      Cerrar sesión
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setActiveQrModalId(id);
                        socket.emit("whatsapp_reset", {
                          userId,
                          instanceId: id,
                        });
                      }}
                    >
                      Generar nuevo QR
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
