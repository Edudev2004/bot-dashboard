const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { saveMessage, getMessagesByOwner } = require('../services/firestoreService');
const { getIO }    = require('../sockets/socketManager');
const { detectType } = require('../utils/botUtils');
const { processMessage, preloadCache, invalidateCache } = require('./chatbotEngine');
const QRCode = require('qrcode');

// Almacén de clientes activos (uno por usuario)
const bots = new Map();

/**
 * Inicia o retorna un bot de WhatsApp para un usuario específico.
 */
const initBotForUser = async (userId) => {
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

    bots.set(userId, client);

    // Pre-cargar árbol y config del cliente en caché
    preloadCache(userId).catch(err =>
        console.error(`[WhatsApp ${userId}] Error al precargar caché:`, err.message)
    );

    // ─── Eventos ──────────────────────────────────────────────────────────────

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

        const chatId  = msg.from;
        const body    = (msg.body || '').trim();
        const date    = new Date().toISOString();

        try {
            // 1. Guardar y emitir mensaje al Dashboard
            const savedMessage = await saveMessage({
                chatId: chatId.split('@')[0],
                text: body,
                type: detectType(body.toLowerCase()),
                date,
                source: 'whatsapp',
                ownerId: userId
            });
            getIO().to(`user_${userId}`).emit('new_message', savedMessage);

            // 2. Procesar con el motor del chatbot
            const { text, mediaUrl, mediaType } = await processMessage(userId, chatId, body);

            if (!text && !mediaUrl) return;

            // 3. Enviar respuesta (con media o sin ella)
            if (mediaUrl) {
                try {
                    const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
                    await client.sendMessage(chatId, media, { caption: text || undefined });
                } catch (mediaErr) {
                    console.error(`[WhatsApp ${userId}] Error enviando media:`, mediaErr.message);
                    if (text) await client.sendMessage(chatId, text);
                }
            } else {
                await client.sendMessage(chatId, text);
            }

        } catch (error) {
            console.error(`[WhatsApp ${userId}] Error procesando mensaje:`, error.message);
        }
    });

    client.on('disconnected', (reason) => {
        console.log(`[WhatsApp ${userId}] Desconectado:`, reason);
        getIO().to(`user_${userId}`).emit('whatsapp_status', { connected: false });
        bots.delete(userId);
    });

    client.initialize().catch(err => {
        console.error(`[WhatsApp ${userId}] Fallo en inicialización:`, err.message);
    });

    return client;
};

/**
 * Configura los listeners de Socket.IO para WhatsApp.
 */
const setupWhatsAppSockets = () => {
    getIO().on('connection', (socket) => {
        socket.on('join_private', (userId) => {
            socket.join(`user_${userId}`);
            console.log(`[Socket] Usuario ${userId} unido a sala privada`);
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
                    invalidateCache(userId);
                    getIO().to(`user_${userId}`).emit('whatsapp_status', { connected: false });
                } catch (err) {
                    console.error(`[WhatsApp ${userId}] Error al cerrar sesión:`, err.message);
                }
            }
        });

        socket.on('whatsapp_reset', async (userId) => {
            const client = bots.get(userId);
            try {
                if (client) {
                    await client.destroy();
                    bots.delete(userId);
                }
                initBotForUser(userId);
            } catch (err) {
                console.error(`[WhatsApp ${userId}] Error al reiniciar bot:`, err.message);
            }
        });
    });
};

/**
 * Invalida la caché del árbol para un cliente (llamar tras guardar nodos/config).
 */
const updateBotConfigCache = (userId) => {
    invalidateCache(userId);
    console.log(`[Bot Manager] Caché invalidada para usuario: ${userId}`);
};

module.exports = { initBotForUser, setupWhatsAppSockets, updateBotConfigCache };
