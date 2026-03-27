import React, { useState, useEffect, useMemo } from "react";
import "../TreeEditor.css";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  fetchMessages,
  adminFetchUsers,
  adminUpdateUserStatus,
} from "../services/api";
import { getNodes } from "../services/chatbotApi";
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  Menu,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Send,
  Bot,
  Plus,
  Clock,
  Activity,
  Award,
  AlertTriangle,
  UserCheck,
  Zap,
} from "lucide-react";
import ChatbotEditor from "./ChatbotEditor";
import socket from "../services/socket";
import arboraBlack from "../assets/ARBORA-BLACK.png";
import arboraWhite from "../assets/ARBORA-WHITE.png";

// Registramos los módulos de Chart.js que vamos a usar
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
);

// Formateamos las fechas para mostrarlas de forma legible
const formatDate = (isoString) => {
  try {
    return new Date(isoString).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return isoString;
  }
};

// Formatear número de teléfono (WhatsApp ID) para que se vea con prefijo y espacios
const formatPhoneNumber = (chatId) => {
  if (!chatId) return "";
  const clean = String(chatId).replace(/\D/g, "");
  if (clean.length < 5) return clean;
  // Intento de formato simple: +CC NNN...
  return `+${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
};

// Generamos las iniciales del avatar a partir del chatId
const getInitials = (chatId = "") => String(chatId).slice(-2).toUpperCase();

// Colores y etiquetas para cada tipo de mensaje
const TYPE_CONFIG = {
  menu: {
    label: "Menú",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.15)",
    text: "#6366f1",
  },
  pedido: {
    label: "Pedido",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    text: "#22c55e",
  },
  otro: {
    label: "Otro",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
    text: "#f59e0b",
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────────────────

// Badge de estado de la interacción
const StatusBadge = ({ msg }) => {
  let label = "En proceso";
  let bg = "rgba(99,102,241,0.15)";
  let color = "#6366f1";

  if (msg.isResolved) {
    label = "Resuelto";
    bg = "rgba(34,197,94,0.15)";
    color = "#22c55e";
  } else if (msg.isWarning) {
    label = "Aviso";
    bg = "rgba(249, 115, 22, 0.15)"; // orange
    color = "#f97316";
  } else if (msg.isFallback) {
    label = "Fallback";
    bg = "rgba(239, 68, 68, 0.15)"; // red
    color = "#ef4444";
  } else if (msg.isIgnored) {
    label = "Ignorado";
    bg = "rgba(107, 114, 128, 0.15)"; // gray
    color = "#6b7280";
  }

  return (
    <span className="type-badge" style={{ background: bg, color }}>
      {label}
    </span>
  );
};

// Tarjeta de estadística individual
const StatCard = ({ icon: Icon, label, value, color, trend }) => {
  Icon; // Aseguramos que el linter vea el uso
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        <div className="stat-icon-wrap" style={{ background: `${color}20` }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      {trend !== undefined && (
        <div className={`stat-trend ${trend >= 0 ? "up" : "down"}`}>
          {trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          <span>{Math.abs(trend)}% vs ayer</span>
        </div>
      )}
    </div>
  );
};

// Item de navegación del sidebar
const NavItem = ({ icon: Icon, label, active, onClick }) => {
  Icon; // Aseguramos que el linter vea el uso
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
};

// Componente de Badge de origen (WhatsApp / Telegram)
const SourceBadge = ({ source }) => {
  const isWA = source === "whatsapp";
  return (
    <div className={`source-badge ${isWA ? "wa" : "tg"}`}>
      {isWA ? <MessageCircle size={13} /> : <Send size={13} />}
      <span>{isWA ? "WhatsApp" : "Telegram"}</span>
    </div>
  );
};

// Componente reutilizable para Renderizar la tabla de Mensajes en distintas vistas
const MessagesTable = ({ messages, loading, title, subtitle, isDashboard }) => {
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  // Agrupar mensajes en Sesiones usando el sessionId
  const sessions = useMemo(() => {
    const grouped = {};
    messages.forEach((msg) => {
      // Soporte 'legacy' si los mensajes viejos no tienen sessionId
      const sid = msg.sessionId || `session_legacy_${msg.chatId}`;
      if (!grouped[sid]) {
        grouped[sid] = {
          id: sid,
          chatId: msg.chatId,
          source: msg.source,
          messages: [],
          startDate: msg.date,
          lastDate: msg.date,
          statusMsg: msg, // Usamos este para el status final
        };
      }

      grouped[sid].messages.push(msg);

      // Actualizar fecha final si es más reciente
      if (new Date(msg.date) >= new Date(grouped[sid].lastDate)) {
        grouped[sid].lastDate = msg.date;
        // Si el estado de este nuevo es resuelto, lo marcamos permanente
        if (!grouped[sid].statusMsg.isResolved) {
          grouped[sid].statusMsg = msg;
        }
      }

      // La sesión se considera Resuelta si cualquier mensaje llegó a éxito
      if (msg.isResolved) {
        grouped[sid].statusMsg = msg;
      }
    });

    // Convertir el Map a un Array y ordenar de la sesión más reciente a la más antigua
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

                          {/* Ordenamos cronológicamente ascendente para leer tipo WhatsApp */}
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

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard principal
// ──────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ theme, toggleTheme, onLogout }) {
  // Estado principal
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(socket.connected);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [waDevices, setWaDevices] = useState({}); // { [id]: { connected, qr, message } }
  const [activeQrModalId, setActiveQrModalId] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const userId = localStorage.getItem("userId");

  const [nodes, setNodes] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const userRole = localStorage.getItem("role");

  useEffect(() => {
    setLoading(true);
    const promises = [fetchMessages(), getNodes()];
    if (userRole === "administrator") promises.push(adminFetchUsers());

    Promise.all(promises)
      .then(([msgs, nodesData, usersData]) => {
        setMessages(msgs);
        setNodes(nodesData);
        if (usersData) setAllUsers(usersData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userRole]);

  const loadAdminUsers = async () => {
    setAdminLoading(true);
    try {
      const data = await adminFetchUsers();
      setAllUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAdminLoading(false);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await adminUpdateUserStatus(userId, !currentStatus);
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isActive: !currentStatus } : u,
        ),
      );
    } catch (err) {
      console.error(err);
      alert("Error al actualizar el estado del usuario");
    }
  };

  // Nos subscribimos a los eventos de Socket.IO para recibir mensajes en vivo
  useEffect(() => {
    if (userId) {
      socket.emit("join_private", userId);
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNew = (msg) => {
      setMessages((prev) => [msg, ...prev]);
      setLastUpdate(new Date().toLocaleTimeString("es-MX"));
    };

    // Escuchamos actualizaciones de estados de WhatsApp y QRs por instancia
    const onWA_QR = ({ instanceId, qr }) => {
      setWaDevices((prev) => ({
        ...prev,
        [instanceId]: { ...(prev[instanceId] || {}), qr, connected: false },
      }));
      setIsLinking((prevIsLinking) => {
        if (prevIsLinking) {
          setActiveQrModalId(instanceId);
          return false;
        }
        return prevIsLinking;
      });
    };

    const onWA_Status = (update) => {
      const { instanceId, connected, message, removed } = update;
      setWaDevices((prev) => {
        if (removed) {
          const next = { ...prev };
          delete next[instanceId];
          return next;
        }
        return {
          ...prev,
          [instanceId]: {
            ...(prev[instanceId] || {}),
            connected,
            message: message || "",
            qr: connected ? null : prev[instanceId]?.qr || null,
          },
        };
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new_message", onNew);
    socket.on("whatsapp_qr", onWA_QR);
    socket.on("whatsapp_status_update", onWA_Status);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new_message", onNew);
      socket.off("whatsapp_qr", onWA_QR);
      socket.off("whatsapp_status_update", onWA_Status);
    };
  }, [userId]);

  // Función para desconectar un dispositivo específico
  const handleWADisconnect = (instanceId, isPending = false) => {
    if (
      isPending ||
      window.confirm(
        "¿Estás seguro de que quieres desvincular este WhatsApp? Se cerrará la sesión en el teléfono.",
      )
    ) {
      socket.emit("whatsapp_logout", { userId, instanceId });
    }
  };

  // Función para agregar un nuevo dispositivo
  const handleAddDevice = () => {
    setIsLinking(true);
    socket.emit("whatsapp_add_instance", userId);
  };

  // Compute Unique Users for the "Usuarios" view
  const uniqueUsers = useMemo(() => {
    const usersMap = new Map();
    messages.forEach((msg) => {
      if (!usersMap.has(msg.chatId)) {
        usersMap.set(msg.chatId, {
          chatId: msg.chatId,
          count: 0,
          firstDate: msg.date,
          lastDate: msg.date,
        });
      }
      const u = usersMap.get(msg.chatId);
      u.count++;
      if (new Date(msg.date) < new Date(u.firstDate)) u.firstDate = msg.date;
      if (new Date(msg.date) > new Date(u.lastDate)) u.lastDate = msg.date;
    });
    // Sort by count descending
    return Array.from(usersMap.values()).sort((a, b) => b.count - a.count);
  }, [messages]);

  // Cálculo de tendencias reales comparando el volumen de Hoy vs Ayer
  const trends = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(
      startOfToday.getTime() - 24 * 60 * 60 * 1000,
    );

    const todayMsgs = messages.filter((m) => new Date(m.date) >= startOfToday);
    const yesterdayMsgs = messages.filter((m) => {
      const d = new Date(m.date);
      return d >= startOfYesterday && d < startOfToday;
    });

    const diff = (t, y) => {
      if (y === 0) return t > 0 ? 100 : 0;
      return Math.round(((t - y) / y) * 100);
    };

    // Cálculo de éxito (resueltos hoy vs ayer)
    const resolvedToday = todayMsgs.filter((m) => m.isResolved).length;
    const resolvedYesterday = yesterdayMsgs.filter((m) => m.isResolved).length;

    // Cálculo de fallbacks
    const fallbackToday = todayMsgs.filter((m) => m.isFallback).length;
    const fallbackYesterday = yesterdayMsgs.filter((m) => m.isFallback).length;

    return {
      total: diff(todayMsgs.length, yesterdayMsgs.length),
      success: diff(resolvedToday, resolvedYesterday),
      fallback: diff(fallbackToday, fallbackYesterday),
      users: diff(
        new Set(todayMsgs.map((m) => m.chatId)).size,
        new Set(yesterdayMsgs.map((m) => m.chatId)).size,
      ),
      counts: {
        resolved: resolvedToday,
        fallback: fallbackToday,
        total: todayMsgs.length,
        users: new Set(todayMsgs.map((m) => m.chatId)).size,
      },
    };
  }, [messages]);

  // Gráfica de Actividad por Horas (Heatmap)
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const countsPerHB = Array(24).fill(0);
    messages.forEach((m) => {
      const h = new Date(m.date).getHours();
      countsPerHB[h]++;
    });
    return {
      labels: hours.map((h) => `${h}:00`),
      datasets: [
        {
          label: "Mensajes",
          data: countsPerHB,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.1)",
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [messages]);

  // Nodos más visitados (Top 5)
  const topNodesData = useMemo(() => {
    const rootNode = nodes.find((n) => n.isRoot);
    const rootId = rootNode ? rootNode.id : "root";

    const nodeCounts = {};
    messages.forEach((m) => {
      // Excluimos el nodo raíz (bienvenida) para ver solo las opciones de interacción
      if (m.nodeId && m.nodeId !== rootId) {
        nodeCounts[m.nodeId] = (nodeCounts[m.nodeId] || 0) + 1;
      }
    });
    const sorted = Object.entries(nodeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      labels: sorted.map(([id]) => {
        const n = nodes.find((node) => node.id === id);
        return n
          ? n.message?.replace(/<[^>]*>/g, "").slice(0, 20) || "Sin nombre"
          : "Nodo base";
      }),
      datasets: [
        {
          axis: "y",
          label: "Visitas",
          data: sorted.map((s) => s[1]),
          backgroundColor: "rgba(34,197,94,0.7)",
          borderRadius: 4,
        },
      ],
    };
  }, [messages, nodes]);

  // Efectividad del Bot (Donut)
  const botEffectivenessData = useMemo(() => {
    const resolved = messages.filter((m) => m.isResolved).length;
    const fallback = messages.filter((m) => m.isFallback).length;
    const warning = messages.filter((m) => m.isWarning).length;
    const ignored = messages.filter((m) => m.isIgnored).length;
    const others = messages.length - resolved - fallback - warning - ignored;

    return {
      labels: ["Resueltos", "Fallback", "Aviso", "Ignorado", "En Proceso"],
      datasets: [
        {
          data: [resolved, fallback, warning, ignored, others],
          backgroundColor: [
            "#22c55e",
            "#ef4444",
            "#f97316",
            "#6b7280",
            "#f59e0b",
          ],
          borderWidth: 0,
          cutout: "75%",
        },
      ],
    };
  }, [messages]);

  // Retención de Usuarios (Nuevos vs Recurrentes)
  const retentionStats = useMemo(() => {
    const userHistory = {}; // chatId -> firstDate
    messages.forEach((m) => {
      const d = new Date(m.date);
      if (!userHistory[m.chatId] || d < new Date(userHistory[m.chatId])) {
        userHistory[m.chatId] = m.date;
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newUsers = 0;
    let returning = 0;

    const usersActiveToday = new Set(
      messages.filter((m) => new Date(m.date) >= today).map((m) => m.chatId),
    );
    usersActiveToday.forEach((uid) => {
      if (new Date(userHistory[uid]) >= today) newUsers++;
      else returning++;
    });

    return { newUsers, returning };
  }, [messages]);

  // Navegación del sidebar
  const navItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "messages", icon: MessageSquare, label: "Mensajes" },
    { id: "pedidos", icon: ShoppingCart, label: "Pedidos" },
    { id: "botconfig", icon: Bot, label: "Bot Config" },
    { id: "usuarios", icon: Users, label: "Usuarios" },
    ...(userRole === "administrator"
      ? [{ id: "admin", icon: UserCheck, label: "Admin Panel" }]
      : []),
  ];

  return (
    <div className="layout">
      {/* ── VENTANAS DE VINCULACIÓN (QRs activos) ────────────────── */}
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

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
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

      {/* ── CONTENIDO PRINCIPAL ─────────────────────────────────────── */}
      <main className="main">
        {/* Header Superior */}
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

        {/* ── RENDERIZADO DE VISTAS ─────────────────────────────────── */}

        {/* 1. VISTA DASHBOARD (Análisis Avanzado) */}
        {activeNav === "dashboard" && (
          <div className="dashboard-content">
            {/* Métricas Principales */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <div
                    className="stat-icon"
                    style={{
                      backgroundColor: "rgba(99,102,241,0.1)",
                      color: "#6366f1",
                    }}
                  >
                    <MessageSquare size={20} />
                  </div>
                  <div
                    className={`stat-trend ${trends.total >= 0 ? "up" : "down"}`}
                  >
                    {trends.total >= 0 ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                    {Math.abs(trends.total)}%
                  </div>
                </div>
                <div className="stat-value">{trends.counts.total}</div>
                <div className="stat-label">Mensajes Hoy</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <div
                    className="stat-icon"
                    style={{
                      backgroundColor: "rgba(168,85,247,0.1)",
                      color: "#a855f7",
                    }}
                  >
                    <Users size={20} />
                  </div>
                  <div
                    className={`stat-trend ${trends.users >= 0 ? "up" : "down"}`}
                  >
                    {trends.users >= 0 ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                    {Math.abs(trends.users)}%
                  </div>
                </div>
                <div className="stat-value">{trends.counts.users}</div>
                <div className="stat-label">Clientes Activos</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <div
                    className="stat-icon"
                    style={{
                      backgroundColor: "rgba(34,197,94,0.1)",
                      color: "#22c55e",
                    }}
                  >
                    <Award size={20} />
                  </div>
                  <div
                    className={`stat-trend ${trends.success >= 0 ? "up" : "down"}`}
                  >
                    {trends.success >= 0 ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                    {Math.abs(trends.success)}%
                  </div>
                </div>
                <div className="stat-value">{trends.counts.resolved}</div>
                <div className="stat-label">Resoluciones Automáticas</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <div
                    className="stat-icon"
                    style={{
                      backgroundColor: "rgba(239,68,68,0.1)",
                      color: "#ef4444",
                    }}
                  >
                    <AlertTriangle size={20} />
                  </div>
                  <div
                    className={`stat-trend ${trends.fallback <= 0 ? "up" : "down"}`}
                  >
                    {trends.fallback <= 0 ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                    {Math.abs(trends.fallback)}%
                  </div>
                </div>
                <div className="stat-value">{trends.counts.fallback}</div>
                <div className="stat-label">Consultas Fallidas (Bot)</div>
              </div>
            </div>

            {/* Gráficas de Rendimiento */}
            <div className="charts-grid">
              {/* Pulso de Actividad */}
              <div className="card chart-card main-chart">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Pulso de Actividad</h3>
                    <p className="card-subtitle">
                      Volumen de mensajes por hora del día
                    </p>
                  </div>
                  <div className="stat-icon-small">
                    <Clock size={16} />
                  </div>
                </div>
                <div className="chart-container" style={{ height: 300 }}>
                  <Line
                    data={hourlyData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: { color: "rgba(255,255,255,0.05)" },
                        },
                        x: { grid: { display: false } },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Efectividad Visual */}
              <div className="card chart-card side-chart">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Efectividad del Bot</h3>
                    <p className="card-subtitle">
                      Flujos completados vs Fallos
                    </p>
                  </div>
                  <div className="stat-icon-small">
                    <Zap size={16} />
                  </div>
                </div>
                <div
                  className="chart-container-donut"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    minHeight: "300px",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "220px",
                      height: "220px",
                      margin: "0 auto",
                    }}
                  >
                    <Doughnut
                      data={botEffectivenessData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false }, // Extraemos la leyenda a HTML para no descuadrar el centro del canvas
                        },
                      }}
                    />
                    <div
                      className="donut-center"
                      style={{
                        position: "absolute",
                        top: "55%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        textAlign: "center",
                      }}
                    >
                      <div
                        className="donut-value"
                        style={{ fontSize: "35px", fontWeight: "bold" }}
                      >
                        {Math.round(
                          (messages.filter((m) => m.isResolved).length /
                            (messages.length || 1)) *
                            100,
                        )}
                        %
                      </div>
                      <div
                        className="donut-label"
                        style={{
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "1px",
                          opacity: 0.8,
                        }}
                      >
                        Éxito Total
                      </div>
                    </div>
                  </div>

                  {/* Leyenda Custom HTML para mejor distribución vertical */}
                  <div
                    className="custom-chart-legend"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "center",
                      gap: "15px",
                      marginTop: "20px",
                      width: "100%",
                    }}
                  >
                    {botEffectivenessData.labels.map((label, idx) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12.5px",
                          color: theme === "dark" ? "#f1f5f9" : "#475569",
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            backgroundColor:
                              botEffectivenessData.datasets[0].backgroundColor[
                                idx
                              ],
                          }}
                        ></span>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Fila Inferior de Análisis */}
            <div className="secondary-grid">
              {/* Nodos Populares */}
              <div className="card chart-card flex-1">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Interacciones Estrella</h3>
                    <p className="card-subtitle">
                      Nodos del chatbot con mayor tráfico
                    </p>
                  </div>
                  <div className="stat-icon-small">
                    <Activity size={16} />
                  </div>
                </div>
                <div className="chart-container" style={{ height: 200 }}>
                  <Bar
                    data={topNodesData}
                    options={{
                      indexAxis: "y",
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: {
                          beginAtZero: true,
                          grid: { color: "rgba(255,255,255,0.05)" },
                        },
                        y: { grid: { display: false } },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Retención y Fidelidad */}
              <div className="card chart-card flex-1">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Retención de Usuarios</h3>
                    <p className="card-subtitle">
                      Nuevos contactos vs Recurrentes
                    </p>
                  </div>
                  <div className="stat-icon-small">
                    <UserCheck size={16} />
                  </div>
                </div>
                <div className="retention-container">
                  <div className="retention-item">
                    <div className="retention-label">Contactos Nuevos</div>
                    <div className="retention-bar-bg">
                      <div
                        className="retention-bar-fill"
                        style={{
                          width: `${(retentionStats.newUsers / (trends.counts.users || 1)) * 100}%`,
                          backgroundColor: "#3b82f6",
                        }}
                      ></div>
                    </div>
                    <div className="retention-val">
                      {retentionStats.newUsers}
                    </div>
                  </div>
                  <div className="retention-item">
                    <div className="retention-label">Contactos Recurrentes</div>
                    <div className="retention-bar-bg">
                      <div
                        className="retention-bar-fill"
                        style={{
                          width: `${(retentionStats.returning / (trends.counts.users || 1)) * 100}%`,
                          backgroundColor: "#a855f7",
                        }}
                      ></div>
                    </div>
                    <div className="retention-val">
                      {retentionStats.returning}
                    </div>
                  </div>
                  <p className="retention-hint">
                    <Activity size={12} />{" "}
                    {Math.round(
                      (retentionStats.returning / (trends.counts.users || 1)) *
                        100,
                    )}
                    % de los clientes de hoy ya interactuaron anteriormente.
                  </p>
                </div>
              </div>
            </div>

            {/* Tabla de Mensajes Recientes (dentro del dashboard) */}
            <MessagesTable
              messages={messages.slice(0, 10)}
              loading={loading}
              title="Actividad Reciente"
              subtitle="Últimas interacciones captadas por el bot"
              isDashboard={true}
            />
          </div>
        )}

        {/* 2. VISTA MENSAJES HISTÓRICOS */}
        {activeNav === "messages" && (
          <MessagesTable
            messages={messages}
            loading={loading}
            title="Historial de Mensajes"
            subtitle="Todos los registros almacenados en la base de datos"
            isDashboard={false}
          />
        )}

        {/* 3. VISTA CHATBOT EDITOR */}
        {activeNav === "botconfig" && <ChatbotEditor />}

        {/* 4. VISTA USUARIOS / AUDIENCIA */}
        {activeNav === "usuarios" && (
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
        )}

        {/* 6. VISTA PANEL DE ADMINISTRACIÓN */}
        {activeNav === "admin" && userRole === "administrator" && (
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
        )}

        {/* 5. VISTA CONFIGURACIÓN DE DISPOSITIVOS */}
        {activeNav === "settings" && (
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
        )}
      </main>
    </div>
  );
}
