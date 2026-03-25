const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
};

// ─── NODOS ────────────────────────────────────────────────────────────────────

export const getNodes = async () => {
  const res = await fetch(`${API_URL}/api/chatbot/nodes`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Error al obtener nodos');
  return res.json();
};

export const saveNode = async (nodeData) => {
  const res = await fetch(`${API_URL}/api/chatbot/nodes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(nodeData)
  });
  if (!res.ok) throw new Error('Error al guardar nodo');
  return res.json();
};

export const deleteNode = async (nodeId) => {
  const res = await fetch(`${API_URL}/api/chatbot/nodes/${nodeId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Error al eliminar nodo');
  return res.json();
};

// ─── CONFIG GENERAL ───────────────────────────────────────────────────────────

export const getChatbotConfig = async () => {
  const res = await fetch(`${API_URL}/api/chatbot/config`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Error al obtener configuración');
  return res.json();
};

export const saveChatbotConfig = async (config) => {
  const res = await fetch(`${API_URL}/api/chatbot/config`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('Error al guardar configuración');
  return res.json();
};

// ─── UPLOAD ───────────────────────────────────────────────────────────────────

export const uploadFile = async (file) => {
  const token = localStorage.getItem('token');
  const form  = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.details || errorBody.error || 'Error al subir archivo');
  }
  return res.json(); // { url, type }
};
