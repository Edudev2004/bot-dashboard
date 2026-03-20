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
const jwt = require('jsonwebtoken');
const { 
  getMessagesByOwner, 
  getBotConfig, 
  setBotConfig,
  storage 
} = require('./services/firestoreService');
const { 
  findUserByUsername, 
  createUser, 
  verifyPassword 
} = require('./services/authService');
const { 
  initBotForUser, 
  setupWhatsAppSockets, 
  updateBotConfigCache 
} = require('./bot/whatsapp');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Seeding: Si no hay usuario admin, lo creamos una única vez
const seedAdmin = async () => {
    try {
        const admin = await findUserByUsername('admin');
        if (!admin) {
            console.log('[Auth] Sembrando primer usuario administrador...');
            await createUser('admin', 'admin');
        }
    } catch (err) {
        console.error('[Error] Fallo al sembrar admin:', err.message);
    }
};
seedAdmin();

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        req.user = user;
        next();
    });
};

// --- Rutas ---

// Login: Devuelve un JWT si las credenciales son válidas
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await findUserByUsername(username);
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

        const isValid = await verifyPassword(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Contraseña incorrecta' });

        // Al loguear, aseguramos que su bot esté listo o iniciando
        initBotForUser(user.id);

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ token, username: user.username, userId: user.id });
    } catch (err) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Mensajes: Filtramos por el dueño del Token
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await getMessagesByOwner(req.user.id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Configuración del Bot (Menu, Respuestas)
app.get('/api/config', authenticateToken, async (req, res) => {
  try {
    const config = await getBotConfig(req.user.id);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

app.post('/api/config', authenticateToken, async (req, res) => {
  try {
    const config = await setBotConfig(req.user.id, req.body);
    // Actualizamos la caché en el bot de inmediato
    updateBotConfigCache(req.user.id, config);
    res.json({ message: 'Configuración guardada!', config });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    const ownerId = req.user.id;
    const bucket = storage.bucket();
    const fileName = `uploads/${ownerId}/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(fileName);

    const stream = file.createWriteStream({
      metadata: { contentType: req.file.mimetype }
    });

    stream.on('error', (err) => {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Error al subir archivo' });
    });

    stream.on('finish', async () => {
      try {
        // Hacemos el archivo público para que el bot pueda enviarlo
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        res.json({ url: publicUrl });
      } catch (err) {
        // Si falló hacer público, intentamos una URL firmada de corta duración
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '03-17-2030'
        });
        res.json({ url });
      }
    });

    stream.end(req.file.buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error inesperado en upload' });
  }
});

// Un endpoint básico para comprobar que el servidor responde
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API del Bot Dashboard funcionando' });
});

// ─── Servidor HTTP + WebSocket ───────────────────────────────────────────────
// Creamos el servidor HTTP clásico y le adjuntamos Socket.IO
const httpServer = http.createServer(app);
initSocket(httpServer);
setupWhatsAppSockets();

// ─── Inicializar el Bot ───────────────────────────────────────────────────────
// Ya no iniciamos uno global, se inician por usuario al loguear o conectar
console.log('[Sistema] Gestor de bots multi-usuario activo.');

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
