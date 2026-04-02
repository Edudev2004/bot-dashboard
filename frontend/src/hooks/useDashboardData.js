import { useState, useEffect, useMemo } from "react";
import { fetchMessages, adminFetchUsers, adminUpdateUserStatus } from "../services/api";
import { getNodes } from "../services/chatbotApi";
import socket from "../services/socket";

export default function useDashboardData() {
  const [allMessages, setAllMessages] = useState([]);
  const [activeInstanceId, setActiveInstanceId] = useState(localStorage.getItem("activeInstanceId") || null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(socket.connected);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [waDevices, setWaDevices] = useState({});
  const [activeQrModalId, setActiveQrModalId] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const userId = localStorage.getItem("userId");
  const userRole = localStorage.getItem("role");

  // ── Filtrado de mensajes por instancia activa ──────────────────────
  const messages = useMemo(() => {
    if (!activeInstanceId) return allMessages;
    return allMessages.filter(m => (m.instanceId || "default") === activeInstanceId);
  }, [allMessages, activeInstanceId]);

  // ── Carga inicial de datos ──────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const promises = [fetchMessages(), getNodes()];
    if (userRole === "administrator") promises.push(adminFetchUsers());

    Promise.all(promises)
      .then(([msgs, nodesData, usersData]) => {
        setAllMessages(msgs);
        setNodes(nodesData);
        if (usersData) setAllUsers(usersData);
        
        // Si no hay instancia activa seleccionada, tomamos la primera de los mensajes o "default"
        if (!activeInstanceId) {
          const firstInstance = msgs.length > 0 ? (msgs[0].instanceId || "default") : "default";
          setActiveInstanceId(firstInstance);
          localStorage.setItem("activeInstanceId", firstInstance);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userRole, activeInstanceId]);

  // Función para cambiar de instancia
  const switchInstance = (instanceId) => {
    setActiveInstanceId(instanceId);
    localStorage.setItem("activeInstanceId", instanceId);
  };

  // ── Admin helpers ───────────────────────────────────────────────────
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

  const toggleUserStatus = async (targetUserId, currentStatus) => {
    try {
      await adminUpdateUserStatus(targetUserId, !currentStatus);
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserId ? { ...u, isActive: !currentStatus } : u,
        ),
      );
    } catch (err) {
      console.error(err);
      alert("Error al actualizar el estado del usuario");
    }
  };

  // ── Socket.IO events ───────────────────────────────────────────────
  useEffect(() => {
    if (userId) {
      socket.emit("join_private", userId);
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNew = (msg) => {
      setAllMessages((prev) => [msg, ...prev]);
      setLastUpdate(new Date().toLocaleTimeString("es-MX"));
    };

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

  // ── WhatsApp device actions ─────────────────────────────────────────
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

  const handleAddDevice = () => {
    setIsLinking(true);
    socket.emit("whatsapp_add_instance", userId);
  };

  const deleteBot = (instanceId) => {
    // Emitir borrado definitivo al backend
    socket.emit("whatsapp_delete_bot", { userId, instanceId });
    
    // Limpieza local inmediata
    setAllMessages(prev => prev.filter(m => (m.instanceId || "default") !== instanceId));
    setWaDevices(prev => {
      const next = { ...prev };
      delete next[instanceId];
      return next;
    });

    // Si el bot borrado era el activo, cambiar al siguiente disponible o null
    if (activeInstanceId === instanceId) {
      const remainingIds = Object.keys(waDevices).filter(id => id !== instanceId);
      const nextId = remainingIds.length > 0 ? remainingIds[0] : null;
      setActiveInstanceId(nextId);
      if (nextId) localStorage.setItem("activeInstanceId", nextId);
      else localStorage.removeItem("activeInstanceId");
    }
  };

  // ── Datos derivados (cálculos sobre los mensajes filtrados) ────────
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
    return Array.from(usersMap.values()).sort((a, b) => b.count - a.count);
  }, [messages]);

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

    const resolvedToday = todayMsgs.filter((m) => m.isResolved).length;
    const resolvedYesterday = yesterdayMsgs.filter((m) => m.isResolved).length;
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

  const topNodesData = useMemo(() => {
    const rootNode = nodes.find((n) => n.isRoot);
    const rootId = rootNode ? rootNode.id : "root";

    const nodeCounts = {};
    messages.forEach((m) => {
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

  const retentionStats = useMemo(() => {
    const userHistory = {};
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

  return {
    // State
    messages,
    activeInstanceId,
    loading,
    connected,
    lastUpdate,
    waDevices,
    activeQrModalId,
    setActiveQrModalId,
    isLinking,
    nodes,
    allUsers,
    adminLoading,
    userId,
    userRole,
    // Actions
    switchInstance,
    deleteBot,
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
  };
}
