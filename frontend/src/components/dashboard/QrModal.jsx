import React from "react";
import { MessageCircle, RefreshCw } from "lucide-react";

const QrModal = ({ waDevices, activeQrModalId, setActiveQrModalId, handleWADisconnect }) => {
  return (
    <>
      {Object.entries(waDevices).map(
        ([id, dev]) =>
          dev.qr &&
          !dev.connected &&
          id === activeQrModalId && (
            <div key={id} className="qr-overlay">
              <div className="qr-card">
                <div className="qr-header">
                  <MessageCircle size={28} color="#25D366" />
                  <h2>Vincula tu WhatsApp</h2>
                </div>
                <p>
                  Escanea este código QR con el dispositivo que quieras agregar:
                </p>
                <div className="qr-image-wrap">
                  <img src={dev.qr} alt="WhatsApp QR" className="qr-image" />
                </div>
                <div className="qr-footer">
                  <RefreshCw size={14} className="spin-slow" />
                  <span>
                    ID: {id.split("_").pop()} — Esperando vinculación...
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 10, width: "100%" }}
                    onClick={() => {
                      setActiveQrModalId(null);
                      handleWADisconnect(id, true);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ),
      )}
    </>
  );
};

export default QrModal;
