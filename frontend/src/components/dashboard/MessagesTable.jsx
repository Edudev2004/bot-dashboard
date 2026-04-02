import React, { useState, useMemo } from "react";
import { MessageSquare } from "lucide-react";
import StatusBadge from "./StatusBadge";
import SourceBadge from "./SourceBadge";
import CopyButton from "./CopyButton";
import { formatDate, formatPhoneNumber, getInitials } from "../../utils/formatters";

const MessagesTable = ({ messages, loading, title, subtitle, isDashboard }) => {
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  // Agrupar mensajes en Sesiones usando el sessionId
  const sessions = useMemo(() => {
    const grouped = {};
    messages.forEach((msg) => {
      const sid = msg.sessionId || `session_legacy_${msg.chatId}`;
      if (!grouped[sid]) {
        grouped[sid] = {
          id: sid,
          chatId: msg.chatId,
          source: msg.source,
          messages: [],
          startDate: msg.date,
          lastDate: msg.date,
          statusMsg: msg,
        };
      }

      grouped[sid].messages.push(msg);

      if (new Date(msg.date) >= new Date(grouped[sid].lastDate)) {
        grouped[sid].lastDate = msg.date;
        if (!grouped[sid].statusMsg.isResolved) {
          grouped[sid].statusMsg = msg;
        }
      }

      if (msg.isResolved) {
        grouped[sid].statusMsg = msg;
      }
    });

    return Object.values(grouped).sort(
      (a, b) => new Date(b.lastDate) - new Date(a.lastDate),
    );
  }, [messages]);

  const toggleExpand = (sid) => {
    setExpandedSessionId((prev) => (prev === sid ? null : sid));
  };

  return (
    <div
      className="card table-card"
      style={!isDashboard ? { marginTop: 24, marginBottom: 24 } : {}}
    >
      <div className="card-header">
        <div>
          <h3 className="card-title">{title}</h3>
          <p className="card-subtitle">{subtitle}</p>
        </div>
        <span className="badge-count">{messages.length}</span>
      </div>

      {loading ? (
        <div className="table-loading">
          <div className="spinner" />
          <span>Cargando mensajes...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="table-empty">
          <MessageSquare size={36} color="var(--text-muted)" />
          <p>No hay mensajes para mostrar</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="msg-table">
            <thead>
              <tr>
                <th>Fuente</th>
                <th>Usuario</th>
                <th>Mensaje</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, i) => (
                <React.Fragment key={session.id}>
                  {/* Fila Resumen de Sesión */}
                  <tr
                    className={`session-row ${expandedSessionId === session.id ? "expanded" : ""} ${i === 0 && isDashboard ? "row-new" : ""}`}
                    onClick={() => toggleExpand(session.id)}
                    style={{ cursor: "pointer" }}
                    title="Haz clic para ver la conversación completa"
                  >
                    <td>
                      <SourceBadge source={session.source} />
                    </td>
                    <td>
                      <div className="user-cell">
                        <div className="table-avatar">
                          {getInitials(session.chatId)}
                        </div>
                        <span className="chat-id-text">
                          {formatPhoneNumber(session.chatId)}
                        </span>
                        <CopyButton text={session.chatId} />
                      </div>
                    </td>
                    <td className="msg-text-cell">
                      <strong style={{ color: "var(--text-main)" }}>
                        {session.messages.length} mensaje(s)
                      </strong>{" "}
                      <span style={{ opacity: 0.6, fontSize: "13px" }}>
                        en este flujo
                      </span>
                    </td>
                    <td>
                      <StatusBadge msg={session.statusMsg} />
                    </td>
                    <td className="date-cell">
                      {formatDate(session.lastDate)}
                    </td>
                  </tr>

                  {/* Hilo Expandido (Accordion) */}
                  {expandedSessionId === session.id && (
                    <tr className="thread-row">
                      <td
                        colSpan="5"
                        style={{
                          padding: 0,
                          backgroundColor: "var(--bg-card-hover)",
                          borderBottom: "1px solid var(--border-color)",
                        }}
                      >
                        <div
                          className="thread-container"
                          style={{
                            padding: "15px 20px",
                            maxHeight: "400px",
                            overflowY: "auto",
                          }}
                        >
                          <h4
                            style={{
                              marginTop: 0,
                              marginBottom: "15px",
                              fontSize: "12px",
                              textTransform: "uppercase",
                              color: "var(--text-muted)",
                            }}
                          >
                            Desglose de Conversación
                          </h4>

                          {session.messages
                            .sort((a, b) => new Date(a.date) - new Date(b.date))
                            .map((msg, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  gap: "15px",
                                  marginBottom: "10px",
                                  padding: "12px",
                                  backgroundColor: "var(--bg-body)",
                                  borderRadius: "8px",
                                  alignItems: "flex-start",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      fontSize: "13.5px",
                                      color: "var(--text-main)",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    {msg.text || <i>(Archivo Media Adjunto)</i>}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {formatDate(msg.date)}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    minWidth: "85px",
                                    textAlign: "right",
                                  }}
                                >
                                  <StatusBadge msg={msg} />
                                </div>
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MessagesTable;
