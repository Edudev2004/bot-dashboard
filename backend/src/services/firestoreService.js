const { db, storage } = require('../config/firebaseConfig');

/**
 * --- SESIONES DE USUARIO (WhatsApp) ---
 * Guardamos en qué parte del menú está cada número para cada dueño.
 */
const getSession = async (ownerId, chatId) => {
  const docId = `${ownerId}_${chatId}`;
  const doc = await db.collection('bot_sessions').doc(docId).get();
  return doc.exists ? doc.data() : { currentPath: 'root' };
};

const setSession = async (ownerId, chatId, path) => {
  const docId = `${ownerId}_${chatId}`;
  await db.collection('bot_sessions').doc(docId).set({
    currentPath: path,
    updatedAt: new Date().toISOString()
  }, { merge: true });
};

const clearSession = async (ownerId, chatId) => {
  const docId = `${ownerId}_${chatId}`;
  await db.collection('bot_sessions').doc(docId).delete();
};

/**
 * Esta función guarda los mensajes en la colección 'messages' de Firestore
 * Recibimos el chatId del usuario, su mensaje, el tipo y la fecha.
 */
/**
 * Esta función guarda los mensajes en la colección 'messages' de Firestore
 * Recibimos el chatId del usuario, su mensaje, el tipo, la fecha y el OWNER ID
 */
const saveMessage = async ({ chatId, text, type, date, source, ownerId }) => {
  const docRef = await db.collection('messages').add({
    chatId,
    text,
    type,
    date,
    source: source || 'whatsapp',
    ownerId: ownerId || 'admin', // ID del usuario del dashboard dueño del bot
  });

  return {
    id: docRef.id,
    chatId,
    text,
    type,
    date,
    source,
    ownerId,
  };
};

/**
 * Obtiene solo los mensajes de un usuario específico
 */
const getMessagesByOwner = async (ownerId) => {
  const snapshot = await db
    .collection('messages')
    .where('ownerId', '==', ownerId)
    .orderBy('date', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * Obtiene la configuración (Menú, Saludo, Palabras Clave) del bot para un usuario específico.
 * Si no existe, devolvemos una vacía con un saludo por defecto.
 */
const getBotConfig = async (ownerId) => {
  const docRef = db.collection('bot_configs').doc(ownerId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return {
      ownerId,
      greeting: '¡Hola! ¿En qué puedo ayudarte hoy?',
      keywords: [], // Array de objetos { key: 'precio', response: 'Nuestros precios son...' }
      defaultResponse: 'No entiendo tu consulta. Un agente humano te atenderá pronto.'
    };
  }

  return doc.data();
};

/**
 * Guarda o actualiza la configuración del bot para un usuario.
 */
const setBotConfig = async (ownerId, config) => {
  await db.collection('bot_configs').doc(ownerId).set({
    ...config,
    ownerId,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return { ownerId, ...config };
};

module.exports = { 
    saveMessage, 
    getMessagesByOwner, 
    getBotConfig, 
    setBotConfig,
    getSession,
    setSession,
    clearSession,
    storage
};
