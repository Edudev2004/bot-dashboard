const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function cleanup() {
    console.log('Cleaning up bot_instances for admin...');
    await db.collection('bot_instances').doc('admin').delete();
    console.log('Done.');
    process.exit(0);
}

cleanup();
