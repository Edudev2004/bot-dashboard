import axios from 'axios';

// Configuramos Axios para apuntar a nuestro servidor backend en el puerto 3000
const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 10000,
});

// Esta función pide todos los mensajes guardados para la carga inicial del dashboard
export const fetchMessages = async () => {
  const response = await api.get('/api/messages');
  return response.data.data;
};

export default api;
