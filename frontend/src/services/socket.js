import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('[Socket] Connected to server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Socket] Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('[Socket] Connection error:', error.message);
});

export default socket;
