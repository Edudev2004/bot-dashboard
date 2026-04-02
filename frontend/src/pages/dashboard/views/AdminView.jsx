import React from "react";
import { RefreshCw } from "lucide-react";
import { getInitials } from "../../../utils/formatters";

const AdminView = ({
  allUsers,
  loading,
  adminLoading,
  loadAdminUsers,
  toggleUserStatus,
}) => {
  return (
    <div
      className="card table-card"
      style={{ marginTop: 24, marginBottom: 24 }}
    >
      <div className="card-header">
        <div>
          <h3 className="card-title">Gestión de Usuarios</h3>
          <p className="card-subtitle">
            Activa o desactiva las cuentas de los clientes
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={loadAdminUsers}
          disabled={adminLoading}
        >
          <RefreshCw size={14} className={adminLoading ? "spin" : ""} />
        </button>
      </div>

      {loading || adminLoading ? (
        <div className="table-loading">
          <div className="spinner" />
          <span>Cargando usuarios...</span>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="msg-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <div className="table-avatar">
                        {getInitials(u.username)}
                      </div>
                      <span className="chat-id-text">{u.username}</span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td className="date-cell">
                    {u.phonePrefix} {u.phoneNumber}
                  </td>
                  <td>
                    <span
                      className="type-badge"
                      style={{
                        background:
                          u.role === "administrator"
                            ? "rgba(168,85,247,0.1)"
                            : "rgba(99,102,241,0.1)",
                        color:
                          u.role === "administrator"
                            ? "#a855f7"
                            : "#6366f1",
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        className={`badge-status ${u.isActive !== false ? "active" : "inactive"}`}
                      >
                        {u.isActive !== false ? "Activo" : "Desactivado"}
                      </span>
                      {u.username !== "admin" && (
                        <button
                          className={`btn btn-sm ${u.isActive !== false ? "btn-danger" : "btn-success"}`}
                          onClick={() =>
                            toggleUserStatus(u.id, u.isActive !== false)
                          }
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                        >
                          {u.isActive !== false
                            ? "Desactivar"
                            : "Activar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminView;
