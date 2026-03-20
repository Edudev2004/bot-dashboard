import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { fetchMessages } from '../services/api';
import socket from '../services/socket';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const TYPE_LABELS = { menu: '🍽️ Menú', pedido: '📦 Pedido', otro: '💬 Otro' };
const TYPE_COLORS = {
  menu: 'rgba(99, 179, 237, 0.85)',
  pedido: 'rgba(154, 230, 180, 0.85)',
  otro: 'rgba(237, 137, 54, 0.85)',
};

const formatDate = (isoString) => {
  try {
    return new Date(isoString).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
};

const TypeBadge = ({ type }) => (
  <span
    className="badge"
    style={{ background: TYPE_COLORS[type] || TYPE_COLORS.otro }}
  >
    {TYPE_LABELS[type] || type}
  </span>
);

export default function Dashboard() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // ── Load initial messages ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchMessages();
        setMessages(data || []);
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Socket.IO real-time ────────────────────────────────────────────────────
  useEffect(() => {
    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNewMessage = (msg) => {
      setMessages((prev) => [msg, ...prev]);
      setLastUpdate(new Date().toLocaleTimeString('es-MX'));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new_message', onNewMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_message', onNewMessage);
    };
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const counts = messages.reduce(
    (acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    },
    { menu: 0, pedido: 0, otro: 0 }
  );

  const chartData = {
    labels: ['Menú', 'Pedidos', 'Otros'],
    datasets: [
      {
        data: [counts.menu, counts.pedido, counts.otro],
        backgroundColor: [
          TYPE_COLORS.menu,
          TYPE_COLORS.pedido,
          TYPE_COLORS.otro,
        ],
        borderColor: ['rgba(99,179,237,1)', 'rgba(154,230,180,1)', 'rgba(237,137,54,1)'],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#cbd5e0', font: { size: 13 }, padding: 20 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed} mensajes`,
        },
      },
    },
    animation: { animateRotate: true, duration: 600 },
  };

  return (
    <div className="dashboard">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-left">
          <div className="logo">🤖</div>
          <div>
            <h1>Bot Dashboard</h1>
            <p className="subtitle">Monitoreo de mensajes en tiempo real</p>
          </div>
        </div>
        <div className="header-right">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span className="status-text">
            {connected ? 'Conectado' : 'Desconectado'}
          </span>
          {lastUpdate && (
            <span className="last-update">Última actualización: {lastUpdate}</span>
          )}
        </div>
      </header>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <section className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">📨</div>
          <div className="stat-info">
            <span className="stat-value">{messages.length}</span>
            <span className="stat-label">Total Mensajes</span>
          </div>
        </div>
        <div className="stat-card menu">
          <div className="stat-icon">🍽️</div>
          <div className="stat-info">
            <span className="stat-value">{counts.menu}</span>
            <span className="stat-label">Consultas de Menú</span>
          </div>
        </div>
        <div className="stat-card pedido">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <span className="stat-value">{counts.pedido}</span>
            <span className="stat-label">Pedidos Recibidos</span>
          </div>
        </div>
        <div className="stat-card otro">
          <div className="stat-icon">💬</div>
          <div className="stat-info">
            <span className="stat-value">{counts.otro}</span>
            <span className="stat-label">Otros Mensajes</span>
          </div>
        </div>
      </section>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="main-content">
        {/* Message List */}
        <section className="card message-list-card">
          <div className="card-header">
            <h2>Mensajes en Vivo</h2>
            {messages.length > 0 && (
              <span className="message-count">{messages.length}</span>
            )}
          </div>

          {loading ? (
            <div className="loading">
              <div className="spinner" />
              <p>Cargando mensajes...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <span>🤖</span>
              <p>Esperando mensajes del bot...</p>
              <small>Los mensajes aparecerán aquí en tiempo real</small>
            </div>
          ) : (
            <ul className="message-list">
              {messages.map((msg, i) => (
                <li key={msg.id || i} className={`message-item ${i === 0 ? 'new' : ''}`}>
                  <div className="message-header">
                    <span className="chat-id">
                      <span className="avatar">{msg.chatId?.slice(-2)}</span>
                      Chat {msg.chatId}
                    </span>
                    <TypeBadge type={msg.type} />
                  </div>
                  <p className="message-text">{msg.text}</p>
                  <span className="message-date">{formatDate(msg.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Chart */}
        <section className="card chart-card">
          <div className="card-header">
            <h2>Distribución</h2>
          </div>
          {messages.length === 0 ? (
            <div className="empty-state">
              <span>📊</span>
              <p>Sin datos aún</p>
            </div>
          ) : (
            <div className="chart-wrapper">
              <Doughnut data={chartData} options={chartOptions} />
              <div className="chart-legend">
                {[
                  { key: 'menu', label: 'Menú', count: counts.menu },
                  { key: 'pedido', label: 'Pedidos', count: counts.pedido },
                  { key: 'otro', label: 'Otros', count: counts.otro },
                ].map(({ key, label, count }) => (
                  <div key={key} className="legend-item">
                    <span
                      className="legend-dot"
                      style={{ background: TYPE_COLORS[key] }}
                    />
                    <span className="legend-label">{label}</span>
                    <span className="legend-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
