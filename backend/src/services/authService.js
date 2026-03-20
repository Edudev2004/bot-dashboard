const { db } = require('../config/firebaseConfig');
const bcrypt = require('bcryptjs');

/**
 * Busca un usuario en la colección 'users' de Firestore por su nombre de usuario.
 */
const findUserByUsername = async (username) => {
  const snapshot = await db.collection('users')
    .where('username', '==', username)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const userDoc = snapshot.docs[0];
  return { id: userDoc.id, ...userDoc.data() };
};

/**
 * Registra un nuevo usuario (útil para crear el primer admin)
 */
const createUser = async (username, password) => {
  // Ciframos la contraseña antes de guardarla
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const docRef = await db.collection('users').add({
    username,
    password: hashedPassword,
    createdAt: new Date().toISOString()
  });

  return { id: docRef.id, username };
};

/**
 * Verifica si la contraseña coincide
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = { findUserByUsername, createUser, verifyPassword };
