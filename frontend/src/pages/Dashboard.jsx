import React, { useState, useEffect, useMemo } from 'react';
import '../TreeEditor.css';
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
import { fetchMessages, fetchBotConfig, saveBotConfig, uploadFile } from '../services/api';
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
  MessageCircle,
  Send,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';

// ── COMPONENTE: Opción de Árbol (Recursivo) ──────────────────────────
const TreeOption = ({ option, onUpdate, onDelete, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = (field, value) => {
    onUpdate({ ...option, [field]: value });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { url } = await uploadFile(file);
      handleChange('mediaUrl', url);
      handleChange('mediaType', file.type.includes('pdf') ? 'pdf' : 'image');
    } catch (err) {
      console.error(err);
      alert('Fallo al subir archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const addChild = () => {
    const newChildren = [...(option.children || []), { 
      id: Math.random().toString(36).substr(2, 9), 
      label: 'Nueva Opción', 
      content: '', 
      children: [] 
    }];
    handleChange('children', newChildren);
    setIsOpen(true);
  };

  return (
    <div className="tree-node-wrap" style={{ marginLeft: level > 0 ? 20 : 0 }}>
      <div className="tree-node">
        <div className="node-main">
          <button className="node-toggle" onClick={() => setIsOpen(!isOpen)}>
            {option.children?.length > 0 ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <div style={{width:16}}/>}
          </button>
          
          <div className="node-inputs">
            <div className="node-row">
              <input 
                className="node-label-input"
                value={option.label}
                placeholder="Nombre de la opción (Ejem: '1. Catálogo')"
                onChange={(e) => handleChange('label', e.target.value)}
              />
              <div className="node-actions">
                <button className="btn-icon add" title="Añadir Submenú" onClick={addChild}><Plus size={16}/></button>
                <button className="btn-icon delete" title="Eliminar" onClick={onDelete}><Trash2 size={16}/></button>
              </div>
            </div>

            {isOpen && (
              <div className="node-details">
                <label>Respuesta del Bot:</label>
                <textarea 
                  placeholder="Escribe lo que el bot dirá al elegir esta opción..."
                  value={option.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                />
                
                <div className="node-media">
                  {option.mediaUrl ? (
                    <div className="media-preview-wrap">
                      <div className="media-pill">
                        {option.mediaType === 'pdf' ? <FileText size={14}/> : <ImageIcon size={14}/>}
                        <span className="truncate">{option.mediaUrl}</span>
                        <button onClick={() => handleChange('mediaUrl', null)}>×</button>
                      </div>
                    </div>
                  ) : (
                    <label className="upload-label">
                      {isUploading ? <RefreshCw size={14} className="spin"/> : <Upload size={14}/>}
                      <span>{isUploading ? 'Subiendo...' : 'Adjuntar PDF/Imagen'}</span>
                      <input type="file" hidden onChange={handleFileUpload} />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isOpen && option.children?.length > 0 && (
        <div className="node-children">
          {option.children.map((child, idx) => (
            <TreeOption 
              key={child.id || idx}
              option={child}
              level={level + 1}
              onUpdate={(updated) => {
                const newChildren = [...option.children];
                newChildren[idx] = updated;
                handleChange('children', newChildren);
              }}
              onDelete={() => {
                handleChange('children', option.children.filter((_, i) => i !== idx));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
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

// Componente de Badge de origen (WhatsApp / Telegram)
const SourceBadge = ({ source }) => {
  const isWA = source === 'whatsapp';
  return (
    <div className={`source-badge ${isWA ? 'wa' : 'tg'}`}>
      {isWA ? <MessageCircle size={13} /> : <Send size={13} />}
      <span>{isWA ? 'WhatsApp' : 'Telegram'}</span>
    </div>
  );
};

// Componente reutilizable para Renderizar la tabla de Mensajes en distintas vistas
const MessagesTable = ({ messages, loading, title, subtitle, isDashboard }) => {
  return (
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
                <th>Fuente</th>
                <th>Usuario</th>
                <th>Mensaje</th>
                <th>Tipo</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg, i) => (
                <tr key={msg.id || i} className={i === 0 && isDashboard ? 'row-new' : ''}>
                  <td><SourceBadge source={msg.source} /></td>
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
};

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard principal
// ──────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ theme, toggleTheme, onLogout }) {
  // Estado principal
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(socket.connected);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [waQR, setWaQR] = useState(null); // Imagen del QR en Base64
  const [waStatus, setWaStatus] = useState({ connected: false }); // Estado de WhatsApp
  const userId = localStorage.getItem('userId');

  // Configuración del Bot
  const [botConfig, setBotConfig] = useState({
    greeting: '',
    keywords: [],
    defaultResponse: '',
    tree: []
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  // Cargamos los mensajes iniciales desde la API al montar el componente
  useEffect(() => {
    Promise.all([
      fetchMessages().then(setMessages),
      fetchBotConfig().then(cfg => {
        setBotConfig({
          ...cfg,
          tree: cfg.tree || []
        });
      })
    ])
    .catch(console.error)
    .finally(() => {
      setLoading(false);
      setConfigLoading(false);
    });
  }, []);

  // Handlers para la configuración del menú
  const handleConfigChange = (field, value) => {
    setBotConfig(prev => ({ ...prev, [field]: value }));
  };

  const addRootOption = () => {
    setBotConfig(prev => ({
      ...prev,
      tree: [...(prev.tree || []), { 
        id: Math.random().toString(36).substr(2, 9), 
        label: 'Nueva Opción', 
        content: '', 
        children: [] 
      }]
    }));
  };

  const addKeyword = () => {
    setBotConfig(prev => ({
      ...prev,
      keywords: [...prev.keywords, { key: '', response: '' }]
    }));
  };

  const removeKeyword = (index) => {
    setBotConfig(prev => ({
      ...prev,
      keywords: prev.keywords.filter((_, i) => i !== index)
    }));
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await saveBotConfig(botConfig);
      alert('¡Configuración guardada correctamente!');
    } catch (err) {
      console.error(err);
      alert('Error al guardar la configuración');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Nos subscribimos a los eventos de Socket.IO para recibir mensajes en vivo
  useEffect(() => {
    if (userId) {
      socket.emit('join_private', userId);
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNew = (msg) => {
      setMessages((prev) => [msg, ...prev]);
      setLastUpdate(new Date().toLocaleTimeString('es-MX'));
    };

    // Escuchamos el estado de WhatsApp y el QR
    const onWA_QR = (qrImage) => setWaQR(qrImage);
    const onWA_Status = (status) => {
      setWaStatus(status);
      if (status.connected) setWaQR(null); // Si se conecta, quitamos el QR
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new_message', onNew);
    socket.on('whatsapp_qr', onWA_QR);
    socket.on('whatsapp_status', onWA_Status);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_message', onNew);
      socket.off('whatsapp_qr', onWA_QR);
      socket.off('whatsapp_status', onWA_Status);
    };
  }, [userId]);

  // Función para desconectar WhatsApp
  const handleWADisconnect = () => {
    if (window.confirm('¿Estás seguro de que quieres desconectar WhatsApp? Tendrás que escanear el QR de nuevo.')) {
      socket.emit('whatsapp_logout', userId);
    }
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

  // Cálculo de tendencias reales comparando el volumen de Hoy vs Ayer
  const trends = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    const todayMsgs = messages.filter(m => new Date(m.date) >= startOfToday);
    const yesterdayMsgs = messages.filter(m => {
      const d = new Date(m.date);
      return d >= startOfYesterday && d < startOfToday;
    });

    const getCounts = (list) => list.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, { menu: 0, pedido: 0, otro: 0 });

    const tC = getCounts(todayMsgs);
    const yC = getCounts(yesterdayMsgs);

    const diff = (t, y) => {
      if (y === 0) return t > 0 ? 100 : 0;
      return Math.round(((t - y) / y) * 100);
    };

    return {
      total: diff(todayMsgs.length, yesterdayMsgs.length),
      pedido: diff(tC.pedido, yC.pedido),
      menu: diff(tC.menu, yC.menu),
      users: diff(new Set(todayMsgs.map(m => m.chatId)).size, new Set(yesterdayMsgs.map(m => m.chatId)).size)
    };
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
    { id: 'personalized', icon: Settings, label: 'Personalizado' },
    { id: 'usuarios', icon: Users, label: 'Usuarios' },
  ];

  return (
    <div className="layout">
      {/* ── VENTANA DE VINCULACIÓN WHATSAPP ─────────────────────────── */}
      {waQR && !waStatus.connected && (
        <div className="qr-overlay">
          <div className="qr-card">
            <div className="qr-header">
              <MessageCircle size={28} color="#25D366" />
              <h2>Vincula tu WhatsApp</h2>
            </div>
            <p>Abre WhatsApp en tu teléfono, ve a Dispositivos vinculados y escanea este código QR:</p>
            <div className="qr-image-wrap">
              <img src={waQR} alt="WhatsApp QR" className="qr-image" />
            </div>
            <div className="qr-footer">
              <RefreshCw size={14} className="spin-slow" />
              <span>Esperando vinculación...</span>
            </div>
          </div>
        </div>
      )}

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
          <NavItem 
            icon={Settings} 
            label="Configuración" 
            active={activeNav === 'settings'} 
            onClick={() => setActiveNav('settings')} 
          />
          <NavItem 
            icon={LogOut} 
            label="Salir" 
            active={false} 
            onClick={() => {
              if (window.confirm('¿Deseas cerrar la sesión?')) onLogout();
            }} 
          />
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
              <StatCard icon={MessageSquare} label="Total Mensajes" value={messages.length} color="#6366f1" trend={trends.total} />
              <StatCard icon={ShoppingCart} label="Pedidos"        value={counts.pedido}   color="#22c55e" trend={trends.pedido} />
              <StatCard icon={Menu}          label="Consultas Menú" value={counts.menu}     color="#f59e0b" trend={trends.menu} />
              <StatCard icon={Users}         label="Chats Únicos"  value={uniqueUsers.length} color="#ec4899" trend={trends.users} />
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

        {/* VISTA 4: CONFIGURACIÓN PERSONALIZADA (BOT) */}
        {activeNav === 'personalized' && (
          <div className="config-view">
            {configLoading ? (
              <div className="table-loading">
                <div className="spinner" />
                <span>Cargando parámetros...</span>
              </div>
            ) : (
              <>
                <header className="config-header">
                  <div>
                    <h2>Configuración Personalizada</h2>
                    <p>Crea el flujo y las respuestas automáticas para tu bot.</p>
                  </div>
                  <button className="btn btn-primary" onClick={handleSaveConfig} disabled={isSavingConfig}>
                    {isSavingConfig ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                    <span>Guardar Cambios</span>
                  </button>
                </header>

                <div className="config-grid shadow-grid">
                  <div className="card config-card">
                    <div className="card-header"><h3 className="card-title">Saludo Inicial</h3></div>
                    <div className="card-body">
                      <textarea 
                        className="config-textarea" 
                        value={botConfig.greeting} 
                        onChange={(e) => handleConfigChange('greeting', e.target.value)}
                        placeholder="Mensaje de bienvenida..."
                      />
                    </div>
                  </div>

                  <div className="card config-card">
                    <div className="card-header"><h3 className="card-title">Fallback</h3></div>
                    <div className="card-body">
                      <textarea 
                        className="config-textarea"
                        value={botConfig.defaultResponse}
                        onChange={(e) => handleConfigChange('defaultResponse', e.target.value)}
                        placeholder="Si no entiendo..."
                      />
                    </div>
                  </div>

                  <div className="card config-card full-width">
                    <div className="card-header flex-between">
                      <h3 className="card-title">Flujo Decisional (Árbol)</h3>
                      <button className="btn btn-secondary btn-sm" onClick={addRootOption}>
                        <Plus size={14} /> <span>Añadir Opción Base</span>
                      </button>
                    </div>
                    <div className="card-body">
                      <div className="tree-container">
                        {botConfig.tree.map((node, idx) => (
                          <TreeOption 
                            key={node.id} 
                            option={node} 
                            onUpdate={(updated) => {
                              const newTree = [...botConfig.tree];
                              newTree[idx] = updated;
                              handleConfigChange('tree', newTree);
                            }}
                            onDelete={() => {
                              handleConfigChange('tree', botConfig.tree.filter((_, i) => i !== idx));
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="card config-card full-width">
                    <div className="card-header flex-between">
                      <h3 className="card-title">Palabras Clave Especiales</h3>
                      <button className="btn btn-secondary btn-sm" onClick={addKeyword}>
                        <Plus size={14} /> <span>Añadir Palabra</span>
                      </button>
                    </div>
                    <div className="card-body">
                      {botConfig.keywords.length === 0 ? (
                        <p className="empty-text">No hay palabras clave configuradas.</p>
                      ) : (
                        <div className="keyword-list">
                          {botConfig.keywords.map((kw, idx) => (
                            <div key={idx} className="keyword-row" style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                              <input 
                                className="config-input" 
                                value={kw.key} 
                                placeholder="Si el cliente escribe..." 
                                onChange={(e) => {
                                  const news = [...botConfig.keywords]; 
                                  news[idx].key = e.target.value;
                                  handleConfigChange('keywords', news);
                                }} 
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                              />
                              <input 
                                className="config-input"
                                value={kw.response} 
                                placeholder="El bot responde..." 
                                onChange={(e) => {
                                  const news = [...botConfig.keywords]; 
                                  news[idx].response = e.target.value;
                                  handleConfigChange('keywords', news);
                                }} 
                                style={{ flex: 2, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                              />
                              <button className="btn-icon delete" onClick={() => removeKeyword(idx)}>
                                <Trash2 size={16}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
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

        {/* VISTA 6: CONFIGURACIÓN */}
        {activeNav === 'settings' && (
          <div className="settings-container">
            <div className="card settings-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Configuración de Conexiones</h3>
                  <p className="card-subtitle">Gestiona tus bots y servicios conectados</p>
                </div>
              </div>
              
              <div className="settings-section">
                <div className="service-info">
                  <div className="service-icon wa"><MessageCircle size={24} /></div>
                  <div className="service-details">
                    <h4>WhatsApp</h4>
                    <p>{waStatus.connected ? 'Conectado y activo' : 'Desconectado'}</p>
                  </div>
                  <div className={`status-pill ${waStatus.connected ? 'on' : 'off'}`}>
                    {waStatus.connected ? 'Online' : 'Offline'}
                  </div>
                </div>
                
                <div className="service-actions">
                  {waStatus.connected ? (
                    <button className="btn btn-danger" onClick={handleWADisconnect}>
                      Desconectar WhatsApp
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => socket.emit('whatsapp_reset', userId)}>
                      Reintentar Conexión
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
