const { db } = require('../config/firebaseConfig');

/**
 * Esta función guarda los mensajes en la colección 'messages' de Firestore
 * Recibimos el chatId del usuario, su mensaje, el tipo y la fecha.
 */
const saveMessage = async ({ chatId, text, type, date }) => {
  const docRef = await db.collection('messages').add({
    chatId,
    text,
    type,
    date,
  });

  return {
    id: docRef.id,
    chatId,
    text,
    type,
    date,
  };
};

/**
 * Aquí obtenemos todos los mensajes ordenados por fecha de forma descendente
 * Así los más nuevos aparecen primero en nuestro dashboard.
 */
const getAllMessages = async () => {
  const snapshot = await db
    .collection('messages')
    .orderBy('date', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

module.exports = { saveMessage, getAllMessages };
