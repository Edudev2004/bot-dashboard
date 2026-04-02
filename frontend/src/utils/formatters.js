// Formateamos las fechas para mostrarlas de forma legible
export const formatDate = (isoString) => {
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
export const formatPhoneNumber = (chatId) => {
  if (!chatId) return "";
  const clean = String(chatId).replace(/\D/g, "");
  if (clean.length < 5) return clean;
  return `+${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
};

// Generamos las iniciales del avatar a partir del chatId
export const getInitials = (chatId = "") => String(chatId).slice(-2).toUpperCase();

// Colores y etiquetas para cada tipo de mensaje
export const TYPE_CONFIG = {
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
