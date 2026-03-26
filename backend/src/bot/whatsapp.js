const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { saveMessage, getMessagesByOwner, getInstances, saveInstance, deleteInstance, clearSession, getSession, setSession } = require('../services/firestoreService');
const { getIO }    = require('../sockets/socketManager');
const { detectType } = require('../utils/botUtils');
const { processMessage, preloadCache, invalidateCache } = require('./chatbotEngine');
const { getChatbotGeneralConfig } = require('../services/chatbotService');
const QRCode = require('qrcode');

// Almacén de clientes activos (Key: instanceId, Value: { client, userId })
const bots = new Map();
// Mapeo inverso para saber qué instancias tiene cada usuario
const userInstances = new Map(); // userId -> [instanceId]

// Timers para inactividad
const userTimers = new Map(); // key: `${userId}_${contactNumber}` -> { warnTimer, closeTimer }

// Cola de procesamiento de mensajes por usuario
const messageQueues = new Map(); // key: `${userId}_${contactNumber}` -> Promise

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

        const body    = (msg.body || '').trim();
        const date    = new Date().toISOString();

        try {
            // Obtener el contacto real para evitar IDs internos (LIDs) que confunden al dashboard
            const contact = await msg.getContact();
            const contactNumber = contact.number || msg.from.split('@')[0];

            const queueKey = `${userId}_${contactNumber}`;

            // Envoltura de procesamiento para forzar cola secuencial y no cruzar la base de datos
            const processIncomingMessage = async () => {
                // Limpiar timers de inactividad previos
                if (userTimers.has(queueKey)) {
                    const timers = userTimers.get(queueKey);
                    clearTimeout(timers.warnTimer);
                    clearTimeout(timers.closeTimer);
                    userTimers.delete(queueKey);
                }

                console.log(`[WhatsApp ${actualInstanceId}] Mensaje de ${contactNumber}: ${body.slice(0, 20)}...`);

                // 1. Procesar con el motor del chatbot ANTES de guardar el mensaje
                // para saber a qué nodo llegó el usuario con esa interacción
                const botResponse = await processMessage(userId, contactNumber, body);
                const { 
                    text, 
                    mediaUrl, 
                    mediaType, 
                    nodeId, 
                    isResolved, 
                    isFallback,
                    ignored,
                    isIgnored,
                    isWarning 
                } = botResponse;

                // Capturar sessionId para el empaquetado del hilos en el Dashboard
                const currentSession = await getSession(userId, contactNumber);
                const currentSessionId = currentSession ? currentSession.sessionId : `sess_${Date.now()}`;

                const logData = {
                    sessionId: currentSessionId,
                    chatId: contactNumber, // Usamos el número limpio para el dashboard
                    text: body,
                    type: detectType(body.toLowerCase()),
                    date,
                    source: 'whatsapp',
                    ownerId: userId,
                    nodeId,
                    isResolved,
                    isFallback,
                    isWarning: !!isWarning,
                    isIgnored: !!isIgnored || !!ignored
                };

                if (ignored) {
                    // Si el motor aplicó silencio inteligente por spam, guardamos asíncrono y abortamos
                    saveMessage(logData).then(s => getIO().to(`user_${userId}`).emit('new_message', s)).catch(e => null);
                    return;
                }

                // 2. Guardar y emitir mensaje al Dashboard ASINCRONAMENTE (Fire-and-forget)
                // Esto ahorra tiempo enorme de base de datos antes de enviar a WhatsApp
                saveMessage(logData).then(savedMessage => {
                    getIO().to(`user_${userId}`).emit('new_message', savedMessage);
                }).catch(e => console.error("Error guardando el mensaje:", e));

                if (!text && !mediaUrl) return;

                // 3. Enviar respuesta (con media o sin ella) usando msg.from para que whatsapp-web.js sepa a dónde enviarlo
            if (mediaUrl) {
                try {
                    const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
                    await client.sendMessage(msg.from, media, { caption: text || undefined });
                } catch (mediaErr) {
                    console.error(`[WhatsApp ${userId}] Error enviando media:`, mediaErr.message);
                    if (text) await client.sendMessage(msg.from, text);
                }
            } else {
                await client.sendMessage(msg.from, text);
            }

            // Si la consulta ya está resuelta, evitamos el conteo de inactividad
            // y dejamos el chat "abierto" de forma pasiva, sin forzar a responder.
            if (isResolved && !isFallback) {
                return;
            }

            // Cargar configuración de tiempos (usamos el default de ser necesario)
            const config = await getChatbotGeneralConfig(userId);
            
            // Verificar si la sesión actual está en "fase de extensión"
            const userSession = await getSession(userId, contactNumber);
            const isExtended = userSession && userSession.inExtension;
            
            const activeTimeoutMinutes = isExtended 
                ? (config.timeoutExtensionMinutes || config.timeoutMinutes || 5)
                : (config.timeoutMinutes || 5);

            // 4. Configurar nuevo timer de inactividad (Aviso 1 minuto antes, cierre total al final)
            const warnTimer = setTimeout(async () => {
                try {
                    const session = await getSession(userId, contactNumber);
                    if (session && session.currentNodeId) {
                        await client.sendMessage(msg.from, config.timeoutWarningMsg || "⏳ Tu sesión está por cerrarse por inactividad. Si necesitas más tiempo, responde con *1*.");
                        await setSession(userId, contactNumber, { ...session, timeoutWarning: true, updatedAt: new Date().toISOString() });
                    }
                } catch (e) { console.error("Error en warnTimer:", e.message); }
            }, Math.max(1, activeTimeoutMinutes - 1) * 60 * 1000); // Aviso

            const closeTimer = setTimeout(async () => {
                try {
                    const session = await getSession(userId, contactNumber);
                    if (session && session.currentNodeId) {
                        await clearSession(userId, contactNumber);
                        await client.sendMessage(msg.from, config.timeoutCloseMsg || "❌ Chat cerrado por inactividad. Escribe cualquier mensaje para volver a iniciar.");
                        userTimers.delete(timerKey);
                    }
                } catch (e) { console.error("Error en closeTimer:", e.message); }
            }, activeTimeoutMinutes * 60 * 1000); // Cierre

            userTimers.set(queueKey, { warnTimer, closeTimer });
        }; // fin processIncomingMessage

        // Ejecutar respetando la cola secuencial (Promise chaining)
        const currentQueue = messageQueues.get(queueKey) || Promise.resolve();
        const nextQueue = currentQueue.then(() => processIncomingMessage()).catch(e => console.error(`[WhatsApp ${userId}] Error en request secuencial:`, e));
        messageQueues.set(queueKey, nextQueue);

        // Limpieza de memoria en la cola
        nextQueue.finally(() => {
            if (messageQueues.get(queueKey) === nextQueue) {
                messageQueues.delete(queueKey);
            }
        });

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
            
            console.log(`[Socket] Solicitud de logout para instancia: ${actualId}`);
            
            try {
                if (b) {
                    // Solo intentamos logout si parece estar autenticado (tiene info)
                    if (b.client.info) {
                        await b.client.logout().catch(() => {}); 
                    }
                    await b.client.destroy().catch(() => {});
                }
            } catch (err) {
                console.error(`[WhatsApp ${actualId}] Error durante destrucción en logout:`, err.message);
            } finally {
                // SIEMPRE limpiar mapas y avisar al frontal, esté o no el bot vivo
                bots.delete(actualId);
                userInstances.get(userId)?.delete(actualId);
                await deleteInstance(userId, actualId).catch(() => {});
                
                getIO().to(`user_${userId}`).emit('whatsapp_status_update', { 
                    instanceId: actualId, 
                    removed: true 
                });
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

/**
 * Detiene todos los bots de un usuario (para cuando se desactiva la cuenta)
 */
const stopAllBotsForUser = async (userId) => {
    const instances = userInstances.get(userId) || [];
    for (const id of instances) {
        const b = bots.get(id);
        if (b) {
            try {
                await b.client.destroy();
                bots.delete(id);
                console.log(`[Bot Manager] Bot detenido por desactivación de usuario: ${id}`);
            } catch (err) {
                console.error(`[Bot Manager] Error al detener bot ${id}:`, err.message);
            }
        }
    }
    userInstances.delete(userId);
};

module.exports = { initBotForUser, setupWhatsAppSockets, updateBotConfigCache, stopAllBotsForUser };
