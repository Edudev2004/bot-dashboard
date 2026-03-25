const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { saveMessage, getMessagesByOwner, getInstances, saveInstance, deleteInstance } = require('../services/firestoreService');
const { getIO }    = require('../sockets/socketManager');
const { detectType } = require('../utils/botUtils');
const { processMessage, preloadCache, invalidateCache } = require('./chatbotEngine');
const QRCode = require('qrcode');

// Almacén de clientes activos (Key: instanceId, Value: { client, userId })
const bots = new Map();
// Mapeo inverso para saber qué instancias tiene cada usuario
const userInstances = new Map(); // userId -> [instanceId]

const initBotForUser = async (userId, instanceId = null) => {
    // Si no se pasa instanceId, usamos el default (userId) para compatibilidad
    const actualInstanceId = instanceId || `default_${userId}`;
    
    if (bots.has(actualInstanceId)) return bots.get(actualInstanceId).client;

    console.log(`[Bot Manager] Iniciando bot para usuario: ${userId} (Instancia: ${actualInstanceId})`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: actualInstanceId,
            dataPath: `./.wwebjs_auth`
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    bots.set(actualInstanceId, { client, userId });
    
    // Registrar instancia para el usuario en memoria únicamente
    if (!userInstances.has(userId)) userInstances.set(userId, new Set());
    userInstances.get(userId).add(actualInstanceId);

    // Pre-cargar árbol y config del cliente en caché
    preloadCache(userId).catch(err =>
        console.error(`[WhatsApp ${userId}] Error al precargar caché:`, err.message)
    );

    // ─── Eventos ──────────────────────────────────────────────────────────────

    client.on('qr', async (qr) => {
        try {
            const qrImage = await QRCode.toDataURL(qr);
            getIO().to(`user_${userId}`).emit('whatsapp_qr', { instanceId: actualInstanceId, qr: qrImage });
            getIO().to(`user_${userId}`).emit('whatsapp_status_update', { 
                instanceId: actualInstanceId, 
                connected: false, 
                message: 'Esperando escaneo' 
            });
        } catch (err) {
            console.error(`[WhatsApp ${actualInstanceId}] Error QR:`, err.message);
        }
    });

    client.on('ready', async () => {
        console.log(`[WhatsApp ${actualInstanceId}] ¡Listo y conectado!`);
        
        // --- GUARDAR SOLO CUANDO ESTÉ VINCULADO ---
        await saveInstance(userId, actualInstanceId);

        getIO().to(`user_${userId}`).emit('whatsapp_status_update', { 
            instanceId: actualInstanceId, 
            connected: true 
        });
    });

    client.on('message', async (msg) => {
        if (msg.from === 'status@broadcast') return;
        
        // --- FILTRO DE GRUPOS ---
        // Solo respondemos a chats individuales (terminan en @c.us)
        // Ignoramos grupos (terminan en @g.us)
        if (msg.from.endsWith('@g.us')) {
            // console.log(`[WhatsApp ${actualInstanceId}] Ignorando mensaje de grupo: ${msg.from}`);
            return;
        }

        const chatId  = msg.from;
        const body    = (msg.body || '').trim();
        const date    = new Date().toISOString();

        try {
            // 1. Procesar con el motor del chatbot ANTES de guardar el mensaje
            // para saber a qué nodo llegó el usuario con esa interacción
            const botResponse = await processMessage(userId, chatId, body);
            const { 
                text, 
                mediaUrl, 
                mediaType, 
                nodeId, 
                isResolved, 
                isFallback 
            } = botResponse;

            // 2. Guardar y emitir mensaje al Dashboard (Con metadatos del bot)
            const savedMessage = await saveMessage({
                chatId: chatId.split('@')[0],
                text: body,
                type: detectType(body.toLowerCase()),
                date,
                source: 'whatsapp',
                ownerId: userId,
                nodeId,
                isResolved,
                isFallback
            });
            getIO().to(`user_${userId}`).emit('new_message', savedMessage);

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

    client.on('disconnected', async (reason) => {
        console.log(`[WhatsApp ${actualInstanceId}] Desconectado:`, reason);
        
        // Limpiamos de Firestore y Memoria
        await deleteInstance(userId, actualInstanceId);
        bots.delete(actualInstanceId);
        userInstances.get(userId)?.delete(actualInstanceId);

        getIO().to(`user_${userId}`).emit('whatsapp_status_update', { 
            instanceId: actualInstanceId, 
            removed: true 
        });
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
        socket.on('join_private', async (userId) => {
            socket.join(`user_${userId}`);
            console.log(`[Socket] Usuario ${userId} unido a sala privada`);
            
            // Cargar instancias desde Firestore al reconectar el socket
            const savedInstances = await getInstances(userId);
            for (const id of savedInstances) {
                if (!bots.has(id)) {
                    await initBotForUser(userId, id);
                }
            }

            // Enviar estados de todas las instancias del usuario
            const instances = userInstances.get(userId) || [];
            instances.forEach(id => {
                const b = bots.get(id);
                if (b && b.client) {
                    socket.emit('whatsapp_status_update', { 
                        instanceId: id, 
                        connected: b.client.info ? true : false 
                    });
                }
            });
        });

        socket.on('whatsapp_add_instance', async (userId) => {
            const newId = `client_${userId}_${Date.now()}`;
            console.log(`[Socket] Agregando nueva instancia para ${userId}: ${newId}`);
            initBotForUser(userId, newId);
        });

        socket.on('whatsapp_logout', async ({ userId, instanceId }) => {
            const actualId = instanceId || `default_${userId}`;
            const b = bots.get(actualId);
            if (b) {
                try {
                    // Solo intentamos logout si parece estar autenticado (tiene info)
                    if (b.client.info) {
                        await b.client.logout().catch(() => {}); 
                    }
                    await b.client.destroy();
                    bots.delete(actualId);
                    userInstances.get(userId)?.delete(actualId);
                    await deleteInstance(userId, actualId);
                    getIO().to(`user_${userId}`).emit('whatsapp_status_update', { 
                        instanceId: actualId, 
                        removed: true 
                    });
                } catch (err) {
                    console.error(`[WhatsApp ${actualId}] Error al cerrar sesión:`, err.message);
                    // Forzar limpieza de mapas si falla algo crítico
                    bots.delete(actualId);
                }
            }
        });

        socket.on('whatsapp_reset', async ({ userId, instanceId }) => {
            const actualId = instanceId || `default_${userId}`;
            const b = bots.get(actualId);
            try {
                if (b) {
                    await b.client.destroy();
                    bots.delete(actualId);
                }
                initBotForUser(userId, actualId);
            } catch (err) {
                console.error(`[WhatsApp ${actualId}] Error al reiniciar bot:`, err.message);
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
