const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { 
  saveMessage, 
  getMessagesByOwner, 
  getBotConfig,
  getSession,
  setSession,
  clearSession 
} = require('../services/firestoreService');
const { getIO } = require('../sockets/socketManager');
const { detectType } = require('../utils/botUtils');
const QRCode = require('qrcode');

// Almacén de clientes activos (uno por usuario)
const bots = new Map();
// Caché de configuraciones en memoria para mayor velocidad
const botConfigs = new Map();

/**
 * Inicia o retorna un bot para un usuario específico (userId)
 */
const initBotForUser = async (userId) => {
    // Si ya existe y está activo, lo retornamos
    if (bots.has(userId)) return bots.get(userId);

    console.log(`[Bot Manager] Iniciando bot para usuario: ${userId}`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `user_${userId}`,
            dataPath: `./.wwebjs_auth`
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // Guardamos en el mapa
    bots.set(userId, client);

    // Precargamos la configuración del bot (Menú)
    try {
        const config = await getBotConfig(userId);
        botConfigs.set(userId, config);
    } catch (err) {
        console.error(`[WhatsApp ${userId}] Error cargando menú:`, err.message);
    }

    // --- EVENTOS DEL CLIENTE ---

    client.on('qr', async (qr) => {
        try {
            const qrImage = await QRCode.toDataURL(qr);
            getIO().to(`user_${userId}`).emit('whatsapp_qr', qrImage);
            getIO().to(`user_${userId}`).emit('whatsapp_status', { connected: false, message: 'Esperando escaneo' });
        } catch (err) {
            console.error(`[WhatsApp ${userId}] Error QR:`, err.message);
        }
    });

    client.on('ready', () => {
        console.log(`[WhatsApp ${userId}] ¡Listo y conectado!`);
        getIO().to(`user_${userId}`).emit('whatsapp_status', { connected: true });
    });

    client.on('message', async (msg) => {
        if (msg.from === 'status@broadcast') return;

        const chatId = msg.from;
        const body = (msg.body || '').trim();
        const text = body.toLowerCase();
        const date = new Date().toISOString();

        try {
            // 1. Guardar y emitir mensaje al Dashboard
            const savedMessage = await saveMessage({ 
                chatId: chatId.split('@')[0], 
                text: msg.body, 
                type: detectType(text), 
                date, 
                source: 'whatsapp',
                ownerId: userId 
            });
            getIO().to(`user_${userId}`).emit('new_message', savedMessage);

            // 2. Lógica del Chatbot Dinámico
            const config = botConfigs.get(userId);
            if (!config || msg.isStatus) return;

            const session = await getSession(userId, chatId);
            const tree = config.tree || []; // El árbol de opciones
            
            // --- NAVEGACIÓN ---
            let response = null;
            let mediaUrl = null;
            let mediaType = null;
            let newPath = session.currentPath;

            // Opción de resetear o volver al inicio
            if (text === 'hola' || text === 'inicio' || text === 'menu' || text === '0') {
                newPath = 'root';
                response = `${config.greeting}\n\n${formatMenu(tree)}`;
                await setSession(userId, chatId, 'root');
                await client.sendMessage(chatId, response);
                return;
            }

            // Si es un número, intentamos navegar
            const selectedIndex = parseInt(body) - 1;
            if (!isNaN(selectedIndex)) {
                // Buscamos las opciones disponibles en el nivel actual
                const currentOptions = getCurrentLevelOptions(tree, session.currentPath);
                const selectedOption = currentOptions[selectedIndex];

                if (selectedOption) {
                    response = selectedOption.content || selectedOption.label;
                    mediaUrl = selectedOption.mediaUrl;
                    mediaType = selectedOption.mediaType;

                    // Si tiene submenú, lo mostramos y actualizamos el path
                    if (selectedOption.children && selectedOption.children.length > 0) {
                        response += `\n\n${formatMenu(selectedOption.children)}`;
                        newPath = selectedOption.id; // Podría ser jerárquico ej: '1.2'
                    } else {
                        // Si es una hoja, volvemos a root o nos quedamos ahí? 
                        // Por ahora volvemos a root tras mostrar la respuesta final
                        response += `\n\n_Escribe *0* para volver al inicio._`;
                        newPath = 'root';
                    }
                    await setSession(userId, chatId, newPath);
                } else {
                    response = `⚠️ Opción no válida. Por favor, elige un número del 1 al ${currentOptions.length}.\n\nPara volver al inicio escribe *0*.`;
                }
            } else {
                // --- FALLBACK A PALABRAS CLAVE ---
                const matchedKeyword = (config.keywords || []).find(k => 
                    text.includes(k.key.toLowerCase())
                );

                if (matchedKeyword) {
                    response = matchedKeyword.response;
                } else {
                    // Si no hay match y estamos en root, no hacemos nada o mandamos saludo
                    // Si estamos en un submenú, recordamos las opciones
                    if (session.currentPath !== 'root') {
                        const currentOptions = getCurrentLevelOptions(tree, session.currentPath);
                        response = `No entiendo esa opción.\n\n${formatMenu(currentOptions)}`;
                    } else {
                        // En root, ignoramos o mandamos saludo inicial si es muy diferente
                        // response = config.fallback || "No entiendo tu mensaje.";
                    }
                }
            }

            // 3. Enviar Respuesta con Media si aplica
            if (response) {
                if (mediaUrl) {
                    try {
                        const media = await MessageMedia.fromUrl(mediaUrl);
                        await client.sendMessage(chatId, media, { caption: response });
                    } catch (err) {
                        console.error(`[WhatsApp ${userId}] Error enviando media:`, err.message);
                        await client.sendMessage(chatId, response);
                    }
                } else {
                    await client.sendMessage(chatId, response);
                }
            }
        } catch (error) {
            console.error(`[WhatsApp ${userId}] Error:`, error.message);
        }
    });

/**
 * Helper: Formatea un array de opciones como texto: "1. Opción\n2. Opción..."
 */
function formatMenu(options) {
    if (!options || options.length === 0) return '';
    return options.map((opt, i) => `*${i + 1}.* ${opt.label}`).join('\n') + `\n\n*0.* Volver al inicio`;
}

/**
 * Helper: Busca las opciones del nivel actual basado en el path (ID del nodo padre)
 */
function getCurrentLevelOptions(tree, path) {
    if (path === 'root') return tree;
    // Búsqueda recursiva del nodo por ID
    const findNode = (nodes, targetId) => {
        for (const node of nodes) {
            if (node.id === targetId) return node;
            if (node.children) {
                const found = findNode(node.children, targetId);
                if (found) return found;
            }
        }
        return null;
    };
    const node = findNode(tree, path);
    return node && node.children ? node.children : tree;
}

    client.on('disconnected', (reason) => {
        console.log(`[WhatsApp ${userId}] Desconectado:`, reason);
        getIO().to(`user_${userId}`).emit('whatsapp_status', { connected: false });
    });

    client.initialize().catch(err => {
        console.error(`[WhatsApp ${userId}] Fallo inicialización:`, err.message);
    });

    return client;
};

/**
 * Configura los escuchas de Socket.IO para WhatsApp
 * Se debe llamar DESPUÉS de initSocket en index.js
 */
const setupWhatsAppSockets = () => {
    getIO().on('connection', (socket) => {
        // El frontend debe unirse a su propia sala nada más conectar
        socket.on('join_private', (userId) => {
            socket.join(`user_${userId}`);
            console.log(`[Socket] Usuario ${userId} unido a su sala privada`);
            
            // Si el bot de este usuario está listo, le enviamos el estatus actual
            const client = bots.get(userId);
            if (client) {
                socket.emit('whatsapp_status', { connected: true });
            }
        });

        socket.on('whatsapp_logout', async (userId) => {
            const client = bots.get(userId);
            if (client) {
                try {
                    await client.logout();
                    await client.destroy();
                    bots.delete(userId);
                    getIO().to(`user_${userId}`).emit('whatsapp_status', { connected: false });
                } catch (err) {
                    console.error(`[WhatsApp ${userId}] Error al cerrar sesión:`, err.message);
                }
            }
        });

        socket.on('whatsapp_reset', async (userId) => {
            console.log(`[WhatsApp ${userId}] Reintentando conexión...`);
            const client = bots.get(userId);
            try {
                if (client) {
                    await client.destroy();
                    bots.delete(userId);
                }
                // Volvemos a iniciar la instancia
                initBotForUser(userId);
            } catch (err) {
                console.error(`[WhatsApp ${userId}] Error al reiniciar bot:`, err.message);
            }
        });
    });
};

/**
 * Actualiza la caché del bot manualmente (útil tras guardar en el Dashboard)
 */
const updateBotConfigCache = (userId, config) => {
    botConfigs.set(userId, config);
    console.log(`[Bot Manager] Caché de configuración actualizada para: ${userId}`);
};

module.exports = { initBotForUser, setupWhatsAppSockets, updateBotConfigCache };
