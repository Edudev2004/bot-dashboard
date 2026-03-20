import { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
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
  Bot,
} from 'lucide-react';
import { fetchMessages } from '../services/api';
import socket from '../services/socket';

// Registramos los módulos de Chart.js que vamos a usar
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// Formateamos las fechas para mostrarlas de forma legible
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

// Generamos las iniciales del avatar a partir del chatId
const getInitials = (chatId = '') => String(chatId).slice(-2).toUpperCase();

// Colores y etiquetas para cada tipo de mensaje
const TYPE_CONFIG = {
  menu: { label: 'Menú', color: '#6366f1', bg: 'rgba(99,102,241,0.15)', text: '#6366f1' },
  pedido: { label: 'Pedido', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  otro: { label: 'Otro', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
};

// ──────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────────────────

// Badge de tipo con color personalizado
const TypeBadge = ({ type }) => {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.otro;
  return (
    <span className="type-badge" style={{ background: cfg.bg, color: cfg.text }}>
      {cfg.label}
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
        <div className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
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
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
};

// Componente reutilizable para Renderizar la tabla de Mensajes en distintas vistas
const MessagesTable = ({ messages, loading, title, subtitle, isDashboard }) => (
  <div className="card table-card" style={!isDashboard ? { marginTop: 24, marginBottom: 24 } : {}}>
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
              <th>Usuario</th>
              <th>Mensaje</th>
              <th>Tipo</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg, i) => (
              <tr key={msg.id || i} className={i === 0 && isDashboard ? 'row-new' : ''}>
                <td>
                  <div className="user-cell">
                    <div className="table-avatar">{getInitials(msg.chatId)}</div>
                    <span className="chat-id-text">{msg.chatId}</span>
                  </div>
                </td>
                <td className="msg-text-cell">{msg.text}</td>
                <td><TypeBadge type={msg.type} /></td>
                <td className="date-cell">{formatDate(msg.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard principal
// ──────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ theme, toggleTheme }) {
  // Estado principal
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(socket.connected);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [lastUpdate, setLastUpdate] = useState(null);

  // Cargamos los mensajes iniciales desde la API al montar el componente
  useEffect(() => {
    fetchMessages()
      .then((data) => setMessages(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Nos subscribimos a los eventos de Socket.IO para recibir mensajes en vivo
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNew = (msg) => {
      setMessages((prev) => [msg, ...prev]);
      setLastUpdate(new Date().toLocaleTimeString('es-MX'));
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new_message', onNew);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_message', onNew);
    };
  }, []);

  // Compute Unique Users for the "Usuarios" view
  const uniqueUsers = useMemo(() => {
    const usersMap = new Map();
    messages.forEach((msg) => {
      if (!usersMap.has(msg.chatId)) {
        usersMap.set(msg.chatId, { 
          chatId: msg.chatId, 
          count: 0, 
          firstDate: msg.date, 
          lastDate: msg.date 
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

  // Contamos los mensajes por tipo para las estadísticas y gráfica
  const counts = messages.reduce(
    (acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc; },
    { menu: 0, pedido: 0, otro: 0 }
  );

  // Datos para la gráfica de barras
  const barData = {
    labels: ['Menú', 'Pedidos', 'Otros'],
    datasets: [
      {
        label: 'Mensajes',
        data: [counts.menu, counts.pedido, counts.otro],
        backgroundColor: ['rgba(99,102,241,0.8)', 'rgba(34,197,94,0.8)', 'rgba(245,158,11,0.8)'],
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} mensajes` } },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'var(--text-muted)' },
      },
      y: {
        grid: { color: 'var(--border)' },
        ticks: { color: 'var(--text-muted)', stepSize: 1 },
        beginAtZero: true,
      },
    },
  };

  // Datos para la gráfica donut pequeña
  const donutData = {
    labels: ['Menú', 'Pedidos', 'Otros'],
    datasets: [{
      data: [counts.menu, counts.pedido, counts.otro],
      backgroundColor: ['#6366f1', '#22c55e', '#f59e0b'],
      borderWidth: 0,
    }],
  };

  const donutOptions = {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    cutout: '72%',
  };

  // Navegación del sidebar
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'messages', icon: MessageSquare, label: 'Mensajes' },
    { id: 'pedidos', icon: ShoppingCart, label: 'Pedidos' },
    { id: 'menus', icon: Menu, label: 'Menús' },
    { id: 'usuarios', icon: Users, label: 'Usuarios' },
  ];

  return (
    <div className="layout">

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Bot size={22} color="#fff" />
          </div>
          <span className="logo-text">BotDash</span>
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
          <NavItem icon={Settings} label="Configuración" active={false} onClick={() => {}} />
          <NavItem icon={LogOut} label="Salir" active={false} onClick={() => {}} />
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ─────────────────────────────────────── */}
      <main className="main">

        {/* Header */}
        <header className="top-header">
          <div className="header-left">
            <h1 className="page-title">
              {navItems.find(n => n.id === activeNav)?.label || 'Analytics'}
            </h1>
            <span className="page-subtitle">
              {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="header-right">
            {/* Indicador de conexión WebSocket */}
            <div className={`connection-badge ${connected ? 'on' : 'off'}`}>
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{connected ? 'En vivo' : 'Desconectado'}</span>
            </div>

            {/* Última actualización */}
            {lastUpdate && (
              <div className="last-update-badge">
                <RefreshCw size={12} />
                <span>{lastUpdate}</span>
              </div>
            )}

            {/* Toggle de tema */}
            <button className="theme-toggle" onClick={toggleTheme} title="Cambiar tema">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Avatar de usuario */}
            <div className="user-avatar">BD</div>
          </div>
        </header>

        {/* ── RENDER CONDICIONAL DE VISTAS ─────────────────────────────── */}
        
        {/* VISTA 1: DASHBOARD PRINCIPAL */}
        {activeNav === 'dashboard' && (
          <>
            <section className="stats-row">
              <StatCard icon={MessageSquare} label="Total Mensajes" value={messages.length} color="#6366f1" trend={12} />
              <StatCard icon={ShoppingCart} label="Pedidos"        value={counts.pedido}   color="#22c55e" trend={8} />
              <StatCard icon={Menu}          label="Consultas Menú" value={counts.menu}     color="#f59e0b" trend={-3} />
              <StatCard icon={Users}         label="Chats Únicos"  value={uniqueUsers.length} color="#ec4899" trend={5} />
            </section>

            <section className="charts-row">
              <div className="card chart-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Distribución de mensajes</h3>
                    <p className="card-subtitle">Por tipo de consulta</p>
                  </div>
                </div>
                <div className="bar-chart-wrap">
                  {messages.length === 0 ? (
                    <div className="empty-chart">
                      <MessageSquare size={32} color="var(--text-muted)" />
                      <p>Sin datos todavía</p>
                    </div>
                  ) : (
                    <Bar data={barData} options={barOptions} />
                  )}
                </div>
              </div>

              <div className="card donut-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Resumen</h3>
                    <p className="card-subtitle">Total: {messages.length}</p>
                  </div>
                </div>
                {messages.length === 0 ? (
                  <div className="empty-chart">
                    <MessageSquare size={32} color="var(--text-muted)" />
                    <p>Sin datos todavía</p>
                  </div>
                ) : (
                  <div className="donut-wrap">
                    <div className="donut-chart-container">
                      <Doughnut data={donutData} options={donutOptions} />
                      <div className="donut-center-label">
                        <span className="donut-total">{messages.length}</span>
                        <span className="donut-sub">total</span>
                      </div>
                    </div>
                    <ul className="donut-legend">
                      {[
                        { key: 'menu',   label: 'Menú',    color: '#6366f1' },
                        { key: 'pedido', label: 'Pedidos', color: '#22c55e' },
                        { key: 'otro',   label: 'Otros',   color: '#f59e0b' },
                      ].map(({ key, label, color }) => (
                        <li key={key} className="legend-row">
                          <span className="legend-dot" style={{ background: color }} />
                          <span className="legend-name">{label}</span>
                          <span className="legend-val">{counts[key]}</span>
                          <span className="legend-pct">
                            {messages.length ? Math.round((counts[key] / messages.length) * 100) : 0}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            <MessagesTable 
              messages={messages} 
              loading={loading} 
              title="Mensajes recientes" 
              subtitle="Actualizándose en tiempo real" 
              isDashboard={true} 
            />
          </>
        )}

        {/* VISTA 2: TODOS LOS MENSAJES */}
        {activeNav === 'messages' && (
          <MessagesTable 
            messages={messages} 
            loading={loading} 
            title="Todos los mensajes" 
            subtitle="Historial completo de la base de datos" 
            isDashboard={false} 
          />
        )}

        {/* VISTA 3: PEDIDOS */}
        {activeNav === 'pedidos' && (
          <MessagesTable 
            messages={messages.filter(m => m.type === 'pedido')} 
            loading={loading} 
            title="Historial de Pedidos" 
            subtitle="Mensajes filtrados por el tipo 'Pedido'" 
            isDashboard={false} 
          />
        )}

        {/* VISTA 4: MENÚS */}
        {activeNav === 'menus' && (
          <MessagesTable 
            messages={messages.filter(m => m.type === 'menu')} 
            loading={loading} 
            title="Consultas de Menú" 
            subtitle="Mensajes filtrados por el tipo 'Menú'" 
            isDashboard={false} 
          />
        )}

        {/* VISTA 5: USUARIOS ÚNICOS */}
        {activeNav === 'usuarios' && (
          <div className="card table-card" style={{ marginTop: 24, marginBottom: 24 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Usuarios únicos</h3>
                <p className="card-subtitle">Personas que han interactuado con el bot</p>
              </div>
              <span className="badge-count">{uniqueUsers.length}</span>
            </div>

            {loading ? (
              <div className="table-loading">
                <div className="spinner" />
                <span>Cargando usuarios...</span>
              </div>
            ) : uniqueUsers.length === 0 ? (
              <div className="table-empty">
                <Users size={36} color="var(--text-muted)" />
                <p>No hay usuarios registrados</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="msg-table">
                  <thead>
                    <tr>
                      <th>Usuario (Chat ID)</th>
                      <th>Total Mensajes</th>
                      <th>Primer contacto</th>
                      <th>Último mensaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueUsers.map((u) => (
                      <tr key={u.chatId}>
                        <td>
                          <div className="user-cell">
                            <div className="table-avatar">{getInitials(u.chatId)}</div>
                            <span className="chat-id-text">{u.chatId}</span>
                          </div>
                        </td>
                        <td>
                          <span className="type-badge" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                            {u.count} msjs
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

      </main>
    </div>
  );
}
