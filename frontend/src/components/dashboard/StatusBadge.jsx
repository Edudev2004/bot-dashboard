import React from "react";

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
    bg = "rgba(249, 115, 22, 0.15)";
    color = "#f97316";
  } else if (msg.isFallback) {
    label = "Fallback";
    bg = "rgba(239, 68, 68, 0.15)";
    color = "#ef4444";
  } else if (msg.isIgnored) {
    label = "Ignorado";
    bg = "rgba(107, 114, 128, 0.15)";
    color = "#6b7280";
  }

  return (
    <span className="type-badge" style={{ background: bg, color }}>
      {label}
    </span>
  );
};

export default StatusBadge;
