// Conexión con Firebase Admin SDK usando la llave serviceAccountKey.json
const admin = require('firebase-admin');
const path = require('path');

// Buscamos el archivo de credenciales en la raíz de la carpeta backend
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

// Inicializamos la app de Firebase con nuestras credenciales
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `bot-dashboard-84451.firebasestorage.app`
});


// Exportamos la base de datos Firestore para usarla en los servicios
const db = admin.firestore();
const storage = admin.storage();

module.exports = { db, storage };
