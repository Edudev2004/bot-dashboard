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
        // --- FILTRO DE SEGURIDAD ---
        // Ignoramos específicamente: Grupos (@g.us), Canales/Newsletters (@newsletter), y Estados (status@broadcast)
        // Todo lo demás (chats personales con @c.us, @s.whatsapp.net, etc.) pasa al motor.
        if (msg.from.endsWith('@g.us') || msg.from.endsWith('@newsletter') || msg.from.endsWith('@broadcast')) {
            // console.log(`[WhatsApp ${actualInstanceId}] Mensaje ignorado intencionalmente: ${msg.from}`);
            return;
        }

        const body    = (msg.body || '').trim();
        const date    = new Date().toISOString();

        try {
            // Limpiar el ID de WhatsApp: quitar sufijo de dispositivo vinculado (ej: 521234:1 -> 521234)
            const rawId = msg.from.split('@')[0].split(':')[0];
            const contactNumber = rawId;

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

                // Obtener info del contacto (Nombre y número normalizado via WhatsApp)
                const contact = await msg.getContact().catch(() => null);
                // contact.number es el número internacional sin el ':X' de dispositivos
                const realNumber = contact?.number || contactNumber;
                const contactName = contact?.pushname || contact?.name || null;

                // Log de depuración: ver exactamente qué envía WhatsApp
                console.log(`[WhatsApp ${actualInstanceId}] from_raw='${msg.from}' | contact.number='${contact?.number}' | finalNumber='${realNumber}' | name='${contactName}' | text='${body.slice(0, 30)}'`);

                // 1. Procesar con el motor del chatbot ANTES de guardar el mensaje
                const botResponse = await processMessage(userId, realNumber, body);
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

                // ... (Fast reply logic remains the same) ...
                if (!ignored && (text || mediaUrl)) {
                    const sendFastReply = async () => {
                        if (mediaUrl) {
                            try {
                                const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
                                await client.sendMessage(msg.from, media, { caption: text || undefined });
                            } catch (mediaErr) {
                                console.error(`[WhatsApp ${userId}] Error enviando media:`, mediaErr.message);
                                if (text) await client.sendMessage(msg.from, text);
                            }
                        } else if (text) {
                            await client.sendMessage(msg.from, text);
                        }
                    };
                    sendFastReply().catch(e => console.error("Error al enviar respuesta rápida:", e));
                }

                // Capturar sessionId para el empaquetado de hilos en el Dashboard
                const currentSession = await getSession(userId, realNumber);
                const currentSessionId = currentSession ? currentSession.sessionId : `sess_${Date.now()}`;

                const logData = {
                    sessionId: currentSessionId,
                    chatId: realNumber, // Número normalizado
                    contactName, // Guardamos el nombre para el dashboard
                    text: body,
                    type: detectType(body.toLowerCase()),
                    date,
                    source: 'whatsapp',
                    ownerId: userId,
                    instanceId: actualInstanceId,
                    nodeId,
                    isResolved,
                    isFallback,
                    isWarning: !!isWarning,
                    isIgnored: !!isIgnored || !!ignored
                };

                if (ignored) {
                    saveMessage(logData).then(s => getIO().to(`user_${userId}`).emit('new_message', s)).catch(e => null);
                    return;
                }

                // Guardar y emitir mensaje al Dashboard ASINCRONAMENTE
                saveMessage(logData).then(savedMessage => {
                    getIO().to(`user_${userId}`).emit('new_message', savedMessage);
                }).catch(e => console.error("Error guardando el mensaje:", e));

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
                        userTimers.delete(queueKey);
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
            for (const inst of savedInstances) {
                const id = inst.id;
                if (!bots.has(id)) {
                    await initBotForUser(userId, id);
                }
            }

            // Enviar estados de todas las instancias del usuario (incluyendo nombres)
            const dbInstances = await getInstances(userId);
            dbInstances.forEach(inst => {
                const b = bots.get(inst.id);
                socket.emit('whatsapp_status_update', { 
                    instanceId: inst.id, 
                    name: inst.name,
                    connected: (b && b.client && b.client.info) ? true : false 
                });
            });
        });

        socket.on('whatsapp_add_instance', async (userId) => {
            const newId = `client_${userId}_${Date.now()}`;
            const defaultName = `Nuevo Bot ${Date.now().toString().slice(-4)}`;
            console.log(`[Socket] Agregando nueva instancia para ${userId}: ${newId}`);
            
            // Guardar en DB con nombre inicial
            const { saveInstance } = require('../services/firestoreService');
            await saveInstance(userId, newId, defaultName);

            // Informar inmediatamente al frontend para evitar que el usuario vuelva a clickear
            getIO().to(`user_${userId}`).emit('whatsapp_status_update', { 
                instanceId: newId, 
                name: defaultName,
                connected: false,
                message: 'Iniciando WhatsApp...' 
            });
            
            initBotForUser(userId, newId);
        });

        socket.on('whatsapp_rename_instance', async ({ userId, instanceId, newName }) => {
            console.log(`[Socket] Renombrando instancia ${instanceId} a: ${newName}`);
            const { updateInstanceName } = require('../services/firestoreService');
            await updateInstanceName(userId, instanceId, newName);
            
            // Avisar a todos los dispositivos del usuario del cambio de nombre
            const b = bots.get(instanceId);
            getIO().to(`user_${userId}`).emit('whatsapp_status_update', { 
                instanceId, 
                name: newName,
                connected: (b && b.client && b.client.info) ? true : false 
            });
        });

        socket.on('whatsapp_delete_bot', async ({ userId, instanceId }) => {
            const actualId = instanceId || `default_${userId}`;
            const b = bots.get(actualId);
            
            console.log(`[Socket] Solicitud de ELIMINACIÓN DEFINITIVA para instancia: ${actualId}`);
            
            try {
                if (b) {
                    // 1. Intentamos logout elegante si está conectado
                    if (b.client.info) {
                        await b.client.logout().catch(() => {}); 
                    }
                    // 2. Extraer el proceso padre del navegador (Puppeteer) para matarlo a nivel de Sistema Operativo
                    let browserProc = null;
                    if (b.client.pupBrowser && b.client.pupBrowser.process) {
                        browserProc = b.client.pupBrowser.process();
                    }

                    // 3. Destruimos el cliente (Cerramos Puppeteer/Chrome vía webSocket)
                    await b.client.destroy().catch(() => {});
                    
                    // 4. Force KILL al proceso zombi si quedó colgado
                    if (browserProc && browserProc.pid) {
                        try {
                            process.kill(browserProc.pid, 'SIGKILL'); // Falla silenciosa si ya estaba muerto
                        } catch (e) {
                            // Ignorar (es normal si destroy() lo cerró bien)
                        }
                    }

                    // Pequeña espera para asegurar que el SO liberó los candados de disco en Windows
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (err) {
                console.error(`[WhatsApp ${actualId}] Error en destrucción de bot:`, err.message);
            } finally {
                // 3. Limpieza física forzada del disco duro
                try {
                    const sessionPath = path.join(__dirname, `../../.wwebjs_auth/session-${actualId}`);
                    if (fs.existsSync(sessionPath)) {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                        console.log(`[Bot Manager] 🧹 Carpeta física de sesión borrada: ${actualId}`);
                    }
                } catch (rmErr) {
                    console.error(`[Bot Manager] ⚠️ No se pudo borrar físicamente la carpeta ${actualId}:`, rmErr.message);
                }

                // 4. Limpieza de memoria y base de datos
                bots.delete(actualId);
                const userInst = userInstances.get(userId);
                if (userInst) userInst.delete(actualId);
                
                await deleteInstance(userId, actualId).catch(() => {});
                
                // 5. Notificar a la interfaz
                getIO().to(`user_${userId}`).emit('whatsapp_status_update', { 
                    instanceId: actualId, 
                    removed: true 
                });
            }
        });

        // Mantenemos logout como alias por si acaso
        socket.on('whatsapp_logout', (data) => socket.emit('whatsapp_delete_bot', data));

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
