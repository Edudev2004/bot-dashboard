import React, { useMemo } from "react";
import { Bell, ShoppingBag, CheckCircle, Clock } from "lucide-react";

const CalendarView = ({ orders }) => {
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  // --- CÁLCULOS DE MÉTRICAS ---
  const tomorrowOrdersCount = useMemo(() => {
    return orders.filter(o => {
      const d = new Date(o.deliveryDate);
      return d.toDateString() === tomorrow.toDateString();
    }).length;
  }, [orders, tomorrow]);

  const stats = useMemo(() => {
    const next7Days = new Date(today);
    next7Days.setDate(today.getDate() + 7);

    return {
      pending: orders.filter(o => o.status === "Pendiente").length,
      thisWeek: orders.filter(o => {
        const d = new Date(o.deliveryDate);
        return d >= today && d <= next7Days;
      }).length,
      completed: orders.filter(o => o.status === "Completado").length
    };
  }, [orders, today]);

  // --- GENERACIÓN DE DÍAS (Vista Semanal enfocada en hoy) ---
  const calendarDays = useMemo(() => {
    const days = [];
    // Mostramos 3 días antes y 3 días después de hoy para tener 7 en total
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        date: d,
        dayNum: d.getDate(),
        dayLabel: d.toLocaleString('es-ES', { weekday: 'short' }).toUpperCase(),
        isToday: i === 0,
        hasOrders: orders.some(o => new Date(o.deliveryDate).toDateString() === d.toDateString())
      });
    }
    return days;
  }, [orders, today]);

  const currentMonthLabel = today.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="dashboard-content premium-calendar-view animate-fade-in">
      {/* HEADER PREMIUM */}
      <div className="calendar-premium-header">
        <div className="header-left">
          <h1 className="month-title">{currentMonthLabel}</h1>
          <p className="sub-header-title">CALENDARIO DE ENTREGAS</p>
        </div>
        
        {tomorrowOrdersCount > 0 && (
          <div className="tomorrow-alert-badge">
            <Bell size={16} className="shake-icon" />
            <span>{tomorrowOrdersCount} ENTREGAS MAÑANA</span>
          </div>
        )}
      </div>

      {/* FILA DE DÍAS (WEEK VIEW) */}
      <div className="week-grid-container">
        <div className="week-days-labels">
          {calendarDays.map((d, i) => (
            <div key={i} className="day-label-item">{d.dayLabel}</div>
          ))}
        </div>
        <div className="week-days-row">
          {calendarDays.map((d, i) => (
            <div key={i} className={`day-card-premium ${d.isToday ? 'active' : ''}`}>
              <span className="day-number-large">{d.dayNum}</span>
              {d.hasOrders && <div className="glow-dot-mint"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* MÉTRICAS INFERIORES */}
      <div className="calendar-stats-footer">
        <div className="stat-metric-card stat-pending">
          <div className="metric-value-wrap">
            <span className="metric-number">{stats.pending}</span>
            <Clock size={20} className="metric-icon-bg" />
          </div>
          <p className="metric-label">PENDIENTES</p>
        </div>

        <div className="stat-metric-card stat-week">
          <div className="metric-value-wrap">
            <span className="metric-number">{stats.thisWeek}</span>
            <ShoppingBag size={20} className="metric-icon-bg" />
          </div>
          <p className="metric-label">ESTA SEMANA</p>
        </div>

        <div className="stat-metric-card stat-completed">
          <div className="metric-value-wrap">
            <span className="metric-number">{stats.completed}</span>
            <CheckCircle size={20} className="metric-icon-bg" />
          </div>
          <p className="metric-label">COMPLETADOS</p>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
