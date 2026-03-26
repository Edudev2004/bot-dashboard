import axios from 'axios';

// Configuramos Axios para apuntar a nuestro servidor backend en el puerto 3000
const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 10000,
});

// Interceptor para añadir el Token JWT a cada petición si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * Pide todos los mensajes guardados (Endpoint protegido con JWT)
 */
export const fetchMessages = async () => {
  try {
    const response = await api.get('/api/messages');
    return response.data; // El backend devuelve un array directamente
  } catch (err) {
    console.error('[API] Error al obtener mensajes:', err.message);
    throw err;
  }
};

/**
 * Autenticación real contra el Backend
 */
export const login = async (username, password) => {
  const response = await api.post('/api/login', { username, password });
  return response.data; // { token, username }
};

/**
 * Registro de nuevo usuario
 */
export const register = async (userData) => {
  const response = await api.post('/api/register', userData);
  return response.data;
};

/**
 * Obtiene la configuración del bot (Menu, etc)
 */
export const fetchBotConfig = async () => {
  const response = await api.get('/api/config');
  return response.data;
};

/**
 * Guarda la configuración del bot
 */
export const saveBotConfig = async (config) => {
  const response = await api.post('/api/config', config);
  return response.data;
};

/**
 * Sube un archivo al storage
 */
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data; // { url }
};

/**
 * Obtiene todos los usuarios (Solo Admin)
 */
export const adminFetchUsers = async () => {
  const response = await api.get('/api/admin/users');
  return response.data;
};

/**
 * Activa/Desactiva un usuario (Solo Admin)
 */
export const adminUpdateUserStatus = async (userId, isActive) => {
  const response = await api.patch(`/api/admin/users/${userId}/status`, { isActive });
  return response.data;
};

export default api;
