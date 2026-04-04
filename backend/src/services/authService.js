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
 * Registra un nuevo usuario
 */
const createUser = async (userData) => {
  const { username, password, email, phonePrefix, phoneNumber, role = 'client' } = userData;
  
  // Verificar si el usuario o email ya existen
  const existingUser = await findUserByUsername(username);
  if (existingUser) {
    throw new Error('El nombre de usuario ya está en uso');
  }

  const existingEmail = await db.collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();
  
  if (!existingEmail.empty) {
    throw new Error('El correo electrónico ya está registrado');
  }

  // Ciframos la contraseña antes de guardarla
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = {
    username,
    email,
    phonePrefix,
    phoneNumber,
    password: hashedPassword,
    role,
    isActive: true, // Por defecto activado
    createdAt: new Date().toISOString()
  };

  const docRef = await db.collection('users').add(newUser);

  // --- AUTOMATIZACIÓN: Crear el primer bot por defecto ---
  try {
    const { saveInstance } = require('./firestoreService');
    const defaultInstanceId = `client_${docRef.id}_${Date.now()}`;
    await saveInstance(docRef.id, defaultInstanceId, "Mi primer Bot");
    console.log(`[Auth] Bot inicial creado para el usuario ${docRef.id}`);
  } catch (err) {
    console.error(`[Auth] Error al crear bot inicial:`, err.message);
  }

  return { id: docRef.id, username, email, role, isActive: true };
};

/**
 * Obtiene todos los usuarios (Rol: administrator)
 */
const getAllUsers = async () => {
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Actualiza el estado de activación de un usuario
 */
const updateUserStatus = async (userId, isActive) => {
  await db.collection('users').doc(userId).update({ isActive });
  return { id: userId, isActive };
};

/**
 * Verifica si la contraseña coincide
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = { findUserByUsername, createUser, verifyPassword, getAllUsers, updateUserStatus };
