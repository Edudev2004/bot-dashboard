import { io } from 'socket.io-client';

// Nos conectamos al servidor backend de Socket.IO
const socket = io('http://localhost:3000', {
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Logs básicos para saber si estamos conectados en tiempo real
socket.on('connect', () => {
  console.log('[Socket] ¡Conectados con éxito! ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Socket] Nos hemos desconectado del servidor');
});

socket.on('connect_error', (error) => {
  console.error('[Socket] Hubo un error al intentar conectar:', error.message);
});

export default socket;
