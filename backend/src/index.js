require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');

const { initSocket }          = require('./sockets/socketManager');
const { getMessagesByOwner, getBotConfig, setBotConfig, storage } = require('./services/firestoreService');
const { findUserByUsername, createUser, verifyPassword, getAllUsers, updateUserStatus }          = require('./services/authService');
const { initBotForUser, setupWhatsAppSockets, updateBotConfigCache, stopAllBotsForUser } = require('./bot/whatsapp');
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

// --- Configuración de Almacenamiento Local ---
const storageLocal = multer.diskStorage({
    destination: (req, file, cb) => {
        // En un entorno real req.user.id vendría del token ya validado en el endpoint
        // Pero multer procesa los campos ANTES de que el middleware de auth corra si se usa como middleware directo
        // Así que usamos una carpeta temporal o base y luego la movemos, o simplemente /uploads
        const dir = path.join(__dirname, '../public/uploads'); 
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, `${Date.now()}_${safeName}`);
    }
});
const upload = multer({ storage: storageLocal });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
// Servir archivos estáticos de la carpeta public
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ─── Auth Middleware ──────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        
        // Verificar en DB si sigue activo
        try {
            const user = await findUserByUsername(decoded.username);
            if (!user || user.isActive === false) {
                return res.status(403).json({ error: 'Cuenta desactivada o no encontrada' });
            }
            req.user = decoded;
            next();
        } catch (dbErr) {
            res.status(500).json({ error: 'Error de servidor en autentificación' });
        }
    });
};

// --- Admin Middleware ---
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'administrator') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador' });
    }
};

// ─── Seed admin ───────────────────────────────────────────────────────────────
const seedAdmin = async () => {
    try {
        const admin = await findUserByUsername('admin');
        if (!admin) {
            console.log('[Auth] Sembrando primer usuario administrador...');
            await createUser({ 
                username: 'admin', 
                password: 'admin', 
                email: 'admin@arbora.com', 
                role: 'administrator' 
            });
        }
    } catch (err) {
        console.error('[Error] Fallo al sembrar admin:', err.message);
    }
};
seedAdmin();

// ─── RUTAS DE AUTENTICACIÓN ───────────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
    try {
        const newUser = await createUser(req.body);
        res.status(201).json({ 
            message: 'Usuario registrado con éxito', 
            userId: newUser.id 
        });
    } catch (err) {
        console.error('[Auth] Error en registro:', err.message);
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await findUserByUsername(username);
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

        const isValid = await verifyPassword(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Contraseña incorrecta' });

        // Verificar si el usuario está activo
        if (user.isActive === false) {
            return res.status(403).json({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role || 'client' },
            JWT_SECRET,
            { expiresIn: '12h' }
        );
        res.json({ 
            token, 
            username: user.username, 
            userId: user.id,
            role: user.role || 'client'
        });
    } catch (err) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// ─── ADMINISTRACIÓN DE USUARIOS ────────────────────────────────────────────────
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await getAllUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

app.patch('/api/admin/users/:id/status', authenticateToken, isAdmin, async (req, res) => {
    const { isActive } = req.body;
    const { id } = req.params;
    try {
        await updateUserStatus(id, isActive);
        
        // Si se desactiva, detenemos sus bots inmediatamente
        if (isActive === false) {
            await stopAllBotsForUser(id);
        }

        res.json({ message: 'Estado de usuario actualizado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar estado' });
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
 * Sube un archivo a la carpeta LOCAL (Para no depender de Firebase Storage de pago).
 */
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

        // Retornamos la URL local (estamos en localhost:3000)
        const publicUrl = `http://localhost:3000/uploads/${req.file.filename}`;
        
        console.log('[Upload] Archivo guardado localmente:', publicUrl);
        res.json({ url: publicUrl, type: req.file.mimetype });

    } catch (err) {
        console.error('[Upload] Error:', err.message);
        res.status(500).json({ error: 'Fallo al procesar subida local' });
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
