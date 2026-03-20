const TelegramBot = require('node-telegram-bot-api');
const { saveMessage } = require('../services/firestoreService');
const { getIO } = require('../sockets/socketManager');

const { detectType, AUTO_REPLIES } = require('../utils/botUtils');

// Obtenemos el token de las variables de entorno (.env)
const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_TOKEN no está definido en el archivo .env');
}

// Inicializamos el bot de Telegram con polling habilitado
const bot = new TelegramBot(token, { polling: true });

// Escuchamos todos los mensajes entrantes
bot.on('message', async (msg) => {
  const chatId = String(msg.chat.id);
  const text = msg.text || '';
  const type = detectType(text);
  const date = new Date().toISOString();

  console.log(`[Bot] Nuevo mensaje de ${chatId}: "${text}" (tipo: ${type})`);

  try {
    // 1. Lo guardamos en nuestra base de datos Firestore
    const savedMessage = await saveMessage({ chatId, text, type, date, source: 'telegram' });

    // 2. Emitimos el nuevo mensaje por WebSockets para que el dashboard se auto-actualice
    getIO().emit('new_message', savedMessage);

    // 3. Le respondemos automáticamente al usuario en Telegram
    await bot.sendMessage(chatId, AUTO_REPLIES[type]);

    console.log(`[Bot] El mensaje se guardó y se emitió correctamente (ID: ${savedMessage.id})`);
  } catch (error) {
    console.error('[Bot] Hubo un error al procesar el mensaje:', error.message);
    await bot.sendMessage(chatId, '⚠️ Ocurrió un error. Intenta de nuevo más tarde.');
  }
});

bot.on('polling_error', (error) => {
  console.error('[Bot] Error de polling de Telegram:', error.message);
});

console.log('[Bot] El bot de Telegram ya está activo y escuchando...');

module.exports = bot;
