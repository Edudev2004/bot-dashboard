require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { initSocket } = require('./sockets/socketManager');
const messagesRoutes = require('./routes/messagesRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
// Permitimos que nuestro frontend en el puerto 5173 acceda a la API
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ─── Rutas ────────────────────────────────────────────────────────────────────
// Todas las rutas de mensajes estarán bajo /api/messages
app.use('/api/messages', messagesRoutes);

// Un endpoint básico para comprobar que el servidor responde
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API del Bot Dashboard funcionando' });
});

// ─── Servidor HTTP + WebSocket ───────────────────────────────────────────────
// Creamos el servidor HTTP clásico y le adjuntamos Socket.IO
const httpServer = http.createServer(app);
initSocket(httpServer);

// ─── Inicializar el Bot ───────────────────────────────────────────────────────
// Llamamos al bot de Telegram una vez que el socket está listo
require('./bot/bot');

// ─── Arrancamos el servidor ───────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Backend corriendo en http://localhost:${PORT}`);
  console.log(`📡 Servidor de tiempo real listo (Socket.IO)`);
  console.log(`🤖 Bot de Telegram escuchando mensajes...\n`);
});

// Manejo de errores globales para que no se caiga el servidor por sorpresas
process.on('unhandledRejection', (reason) => {
  console.error('[Servidor] Error no manejado (Rejection):', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Servidor] Error no capturado:', error.message);
});
