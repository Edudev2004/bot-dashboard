require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const jwt     = require('jsonwebtoken');

const { initSocket }          = require('./sockets/socketManager');
const { getMessagesByOwner, getBotConfig, setBotConfig, storage } = require('./services/firestoreService');
const { findUserByUsername, createUser, verifyPassword }          = require('./services/authService');
const { initBotForUser, setupWhatsAppSockets, updateBotConfigCache } = require('./bot/whatsapp');
const {
  getAllNodes,
  saveNode,
  deleteNode,
  getChatbotGeneralConfig,
  setChatbotGeneralConfig
} = require('./services/chatbotService');

const app    = express();
const PORT   = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const upload = multer({ storage: multer.memoryStorage() });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ─── Auth Middleware ──────────────────────────────────────────────────────────
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

// ─── Seed admin ───────────────────────────────────────────────────────────────
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

// ─── RUTAS DE AUTENTICACIÓN ───────────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await findUserByUsername(username);
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

        const isValid = await verifyPassword(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Contraseña incorrecta' });

        // Iniciar bot del usuario y precargar caché
        initBotForUser(user.id);

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '12h' }
        );
        res.json({ token, username: user.username, userId: user.id });
    } catch (err) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// ─── MENSAJES ─────────────────────────────────────────────────────────────────

app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const messages = await getMessagesByOwner(req.user.id);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener mensajes' });
    }
});

// ─── CONFIGURACIÓN LEGACY (bot_configs) ──────────────────────────────────────

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
        updateBotConfigCache(req.user.id);
        res.json({ message: 'Configuración guardada!', config });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

// ─── CHATBOT — NODOS ─────────────────────────────────────────────────────────

/**
 * GET /api/chatbot/nodes
 * Devuelve todos los nodos del cliente autenticado (array plano con sus opciones).
 */
app.get('/api/chatbot/nodes', authenticateToken, async (req, res) => {
    try {
        const nodes = await getAllNodes(req.user.id);
        res.json(nodes);
    } catch (err) {
        console.error('[API] Error al obtener nodos:', err.message);
        res.status(500).json({ error: 'Error al obtener nodos del chatbot' });
    }
});

/**
 * POST /api/chatbot/nodes
 * Crea o actualiza un nodo.
 * Body: { id?, type, message, isRoot?, parentNodeId?, responseType?, responseContent?, options? }
 */
app.post('/api/chatbot/nodes', authenticateToken, async (req, res) => {
    try {
        const nodeId = await saveNode(req.user.id, req.body);
        updateBotConfigCache(req.user.id); // Invalidar caché del engine
        res.json({ message: 'Nodo guardado', nodeId });
    } catch (err) {
        console.error('[API] Error al guardar nodo:', err.message);
        res.status(500).json({ error: 'Error al guardar nodo' });
    }
});

/**
 * DELETE /api/chatbot/nodes/:id
 * Elimina un nodo y sus opciones (y nullifica referencias de otros nodos hacia él).
 */
app.delete('/api/chatbot/nodes/:id', authenticateToken, async (req, res) => {
    try {
        await deleteNode(req.params.id);
        updateBotConfigCache(req.user.id);
        res.json({ message: 'Nodo eliminado' });
    } catch (err) {
        console.error('[API] Error al eliminar nodo:', err.message);
        res.status(500).json({ error: 'Error al eliminar nodo' });
    }
});

// ─── CHATBOT — CONFIG GENERAL ─────────────────────────────────────────────────

/**
 * GET /api/chatbot/config
 * Obtiene la configuración general del chatbot (saludo, fallback, keywords).
 */
app.get('/api/chatbot/config', authenticateToken, async (req, res) => {
    try {
        const config = await getChatbotGeneralConfig(req.user.id);
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener configuración del chatbot' });
    }
});

/**
 * POST /api/chatbot/config
 * Guarda la configuración general del chatbot.
 * Body: { greeting, fallbackMessage, keywords: [{ key, response }] }
 */
app.post('/api/chatbot/config', authenticateToken, async (req, res) => {
    try {
        const config = await setChatbotGeneralConfig(req.user.id, req.body);
        updateBotConfigCache(req.user.id);
        res.json({ message: 'Configuración del chatbot guardada', config });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar configuración del chatbot' });
    }
});

// ─── SUBIDA DE ARCHIVOS ───────────────────────────────────────────────────────

/**
 * POST /api/upload
 * Sube un archivo (PDF, imagen) a Firebase Storage y retorna la URL pública.
 */
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

        const ownerId  = req.user.id;
        const bucket   = storage.bucket();
        const safeName = req.file.originalname.replace(/\s+/g, '_');
        const fileName = `uploads/${ownerId}/${Date.now()}_${safeName}`;
        const file     = bucket.file(fileName);

        const stream = file.createWriteStream({
            metadata: { contentType: req.file.mimetype }
        });

        stream.on('error', (err) => {
            console.error('Upload error:', err);
            res.status(500).json({ error: 'Error al subir archivo' });
        });

        stream.on('finish', async () => {
            try {
                await file.makePublic();
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                res.json({ url: publicUrl, type: req.file.mimetype });
            } catch {
                const [url] = await file.getSignedUrl({
                    action: 'read',
                    expires: '03-17-2030'
                });
                res.json({ url, type: req.file.mimetype });
            }
        });

        stream.end(req.file.buffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error inesperado en upload' });
    }
});

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Bot Dashboard API funcionando ✅' });
});

// ─── Servidor HTTP + WebSocket ────────────────────────────────────────────────
const httpServer = http.createServer(app);
initSocket(httpServer);
setupWhatsAppSockets();

console.log('[Sistema] Gestor de bots multi-usuario activo.');

httpServer.listen(PORT, () => {
    console.log(`\n🚀 Backend corriendo en http://localhost:${PORT}`);
    console.log(`📡 Servidor de tiempo real listo (Socket.IO)\n`);
});

process.on('unhandledRejection', (reason) => {
    console.error('[Servidor] Error no manejado:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[Servidor] Error no capturado:', error.message);
});
