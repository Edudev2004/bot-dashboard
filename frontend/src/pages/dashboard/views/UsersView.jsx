import React from "react";
import { Users } from "lucide-react";
import { formatDate, formatPhoneNumber, getInitials } from "../../../utils/formatters";

const UsersView = ({ uniqueUsers, loading }) => {
  return (
    <div
      className="card table-card"
      style={{ marginTop: 24, marginBottom: 24 }}
    >
      <div className="card-header">
        <div>
          <h3 className="card-title">Directorio de Usuarios</h3>
          <p className="card-subtitle">
            Contactos que han interactuado con el sistema
          </p>
        </div>
        <span className="badge-count">{uniqueUsers.length}</span>
      </div>

      {loading ? (
        <div className="table-loading">
          <div className="spinner" />
          <span>Analizando audiencia...</span>
        </div>
      ) : uniqueUsers.length === 0 ? (
        <div className="table-empty">
          <Users size={36} color="var(--text-muted)" />
          <p>No hay usuarios registrados en el sistema</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="msg-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Mensajes</th>
                <th>Primer contacto</th>
                <th>Última interacción</th>
              </tr>
            </thead>
            <tbody>
              {uniqueUsers.map((u) => (
                <tr key={u.chatId}>
                  <td>
                    <div className="user-cell">
                      <div className="table-avatar">
                        {getInitials(u.chatId)}
                      </div>
                      <span className="chat-id-text">
                        {formatPhoneNumber(u.chatId)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="type-badge"
                      style={{
                        background: "var(--bg-input)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {u.count} interacciones
                    </span>
                  </td>
                  <td className="date-cell">{formatDate(u.firstDate)}</td>
                  <td className="date-cell">{formatDate(u.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsersView;
