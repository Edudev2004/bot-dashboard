import React from "react";
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
  MessageSquare,
  Users,
  Award,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Zap,
  UserCheck,
} from "lucide-react";
import MessagesTable from "../../../components/dashboard/MessagesTable";

// Registramos los módulos de Chart.js
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

const OverviewView = ({
  messages,
  loading,
  trends,
  hourlyData,
  topNodesData,
  botEffectivenessData,
  retentionStats,
  theme,
}) => {
  return (
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
                    legend: { display: false },
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

            {/* Leyenda Custom HTML */}
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
                        botEffectivenessData.datasets[0].backgroundColor[idx],
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

      {/* Tabla de Mensajes Recientes */}
      <MessagesTable
        messages={messages.slice(0, 10)}
        loading={loading}
        title="Actividad Reciente"
        subtitle="Últimas interacciones captadas por el bot"
        isDashboard={true}
      />
    </div>
  );
};

export default OverviewView;
