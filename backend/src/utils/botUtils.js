/**
 * Detectamos el tipo de mensaje buscando palabras clave
 */
const detectType = (text = '') => {
  const lower = String(text).toLowerCase();
  if (lower.includes('menu') || lower.includes('menú')) return 'menu';
  if (lower.includes('pedido') || lower.includes('orden')) return 'pedido';
  return 'otro';
};

/**
 * Mensajes de respuesta automática comunes
 */
const AUTO_REPLIES = {
  menu: '🍽️ ¡Aquí está nuestro menú! Escribe "pedido" para ordenar.',
  pedido: '✅ ¡Pedido recibido! En breve te contactamos.',
  otro: '👋 ¡Hola! Escribe "menu" para ver el menú o "pedido" para ordenar.',
};

module.exports = { detectType, AUTO_REPLIES };
