const { Server } = require('socket.io');

let io;

/**
 * Inicializamos el servidor de WebSockets adjuntándolo al servidor HTTP de Express
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Permitir cualquier puerto local (Vite a veces salta a 5174 o 5175)
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Cliente conectado con ID: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] El cliente ${socket.id} se ha desconectado`);
    });
  });

  console.log('[Socket] Servidor Socket.IO listo para emitir mensajes');
  return io;
};

/**
 * Una función helper para obtener la instancia de IO desde cualquier otra parte de la app
 */
const getIO = () => {
  if (!io) {
    throw new Error('Debes llamar a initSocket primero en index.js');
  }
  return io;
};

module.exports = { initSocket, getIO };
