/**
 * ChatbotEngine — Motor de navegación del árbol de decisiones.
 *
 * Responsabilidades:
 *  - Cargar el árbol de nodos del cliente desde Firestore (con caché)
 *  - Procesar cada mensaje del usuario (número, texto libre, comandos)
 *  - Devolver una respuesta structurada { text, mediaUrl, mediaType }
 *  - Actualizar la sesión del usuario (nodo actual + historial)
 */

const { getNodeById, getRootNode, getChatbotGeneralConfig } = require('../services/chatbotService');
const { getSession, setSession }                             = require('../services/firestoreService');

// ─── Comandos de reset / volver ───────────────────────────────────────────────
const RESET_COMMANDS  = ['0', 'hola', 'inicio', 'menu', 'menú', 'start'];
const BACK_COMMANDS   = ['atrás', 'atras', 'volver', 'back', '#'];

// ─── Caché en memoria del árbol por cliente ────────────────────────────────────
const nodeCache = new Map(); // ownerId → { nodes: {id: node}, ts }
const CONFIG_CACHE = new Map(); // ownerId → config
const CACHE_TTL_MS = 60_000; // 60 segundos

const invalidateCache = (ownerId) => {
  nodeCache.delete(ownerId);
  CONFIG_CACHE.delete(ownerId);
};

/**
 * Obtiene un nodo de la caché o de Firestore.
 */
const getNode = async (ownerId, nodeId) => {
  const cached = nodeCache.get(ownerId);
  if (cached && (Date.now() - cached.ts < CACHE_TTL_MS) && cached.nodes[nodeId]) {
    return cached.nodes[nodeId];
  }
  const node = await getNodeById(nodeId);
  if (node) {
    const entry = nodeCache.get(ownerId) || { nodes: {}, ts: Date.now() };
    entry.nodes[nodeId] = node;
    entry.ts = Date.now();
    nodeCache.set(ownerId, entry);
  }
  return node;
};

/**
 * Pre-carga el árbol completo en la caché (llamar al iniciar el bot).
 */
const preloadCache = async (ownerId) => {
  try {
    const [rootNode, config] = await Promise.all([
      getRootNode(ownerId),
      getChatbotGeneralConfig(ownerId)
    ]);
    if (rootNode) {
      const entry = nodeCache.get(ownerId) || { nodes: {}, ts: Date.now() };
      entry.nodes[rootNode.id] = rootNode;
      entry.ts = Date.now();
      nodeCache.set(ownerId, entry);
    }
    CONFIG_CACHE.set(ownerId, config);
    return { rootNode, config };
  } catch (err) {
    console.error(`[ChatbotEngine] Error al precargar caché (${ownerId}):`, err.message);
    return {};
  }
};

/**
 * Devuelve el texto formateado de un nodo con sus opciones numeradas.
 * Ejemplo:
 *   "¿En qué te ayudamos?\n\n*1.* Catálogo\n*2.* Pedidos\n\n*0.* Volver al inicio"
 */
const buildNodeMessage = (node, includeBackOption = false) => {
  let text = node.message || '';

  if (node.options && node.options.length > 0) {
    text += '\n\n';
    text += node.options
      .sort((a, b) => a.order - b.order)
      .map((opt, i) => `*${i + 1}.* ${opt.label}`)
      .join('\n');
    if (includeBackOption) {
      text += '\n*#.* ⬅️ Volver';
    }
    text += '\n*0.* 🏠 Menú principal';
  }

  return text;
};

/**
 * Procesa un mensaje entrante de un usuario de WhatsApp.
 *
 * @param {string} ownerId - ID del cliente dueño del bot
 * @param {string} chatId  - ID del chat de WhatsApp (número@c.us)
 * @param {string} userInput - Texto enviado por el usuario
 * @returns {{ text: string, mediaUrl: string|null, mediaType: string|null }}
 */
const processMessage = async (ownerId, chatId, userInput) => {
  const input = (userInput || '').trim();
  const inputLower = input.toLowerCase();

  // Cargar config general
  let config = CONFIG_CACHE.get(ownerId);
  if (!config) {
    config = await getChatbotGeneralConfig(ownerId);
    CONFIG_CACHE.set(ownerId, config);
  }

  // Cargar sesión
  const session = await getSession(ownerId, chatId);
  let { currentNodeId, navigationStack = [] } = session;

  // ── 1. Comandos de RESET ─────────────────────────────────────────────────────
  if (RESET_COMMANDS.includes(inputLower)) {
    const rootNode = await getRootNode(ownerId);
    if (!rootNode) {
      return { text: config.greeting || '¡Hola! 👋', mediaUrl: null, mediaType: null };
    }
    await setSession(ownerId, chatId, { currentNodeId: rootNode.id, navigationStack: [] });
    const text = (currentNodeId === null)
      ? `${config.greeting || '¡Hola! 👋'}\n\n${buildNodeMessage(rootNode)}`
      : buildNodeMessage(rootNode);
    return { text, mediaUrl: null, mediaType: null };
  }

  // ── 2. Si no hay sesión activa → mostrar root ─────────────────────────────────
  if (!currentNodeId) {
    const rootNode = await getRootNode(ownerId);
    if (!rootNode) {
      return {
        text: config.greeting || '¡Hola! 👋 Aún no hemos configurado el bot. Vuelve pronto.',
        mediaUrl: null,
        mediaType: null
      };
    }
    await setSession(ownerId, chatId, { currentNodeId: rootNode.id, navigationStack: [] });
    return {
      text: `${config.greeting || '¡Hola! 👋'}\n\n${buildNodeMessage(rootNode)}`,
      mediaUrl: null,
      mediaType: null
    };
  }

  // ── 3. Cargar nodo actual ─────────────────────────────────────────────────────
  const currentNode = await getNode(ownerId, currentNodeId);
  if (!currentNode) {
    // Nodo eliminado → reiniciar
    const rootNode = await getRootNode(ownerId);
    if (!rootNode) return { text: config.fallbackMessage, mediaUrl: null, mediaType: null };
    await setSession(ownerId, chatId, { currentNodeId: rootNode.id, navigationStack: [] });
    return { text: buildNodeMessage(rootNode), mediaUrl: null, mediaType: null };
  }

  // ── 4. Comando VOLVER ────────────────────────────────────────────────────────
  if (BACK_COMMANDS.includes(inputLower)) {
    if (navigationStack.length === 0) {
      const rootNode = await getRootNode(ownerId);
      if (!rootNode) return { text: config.fallbackMessage, mediaUrl: null, mediaType: null };
      await setSession(ownerId, chatId, { currentNodeId: rootNode.id, navigationStack: [] });
      return { text: buildNodeMessage(rootNode), mediaUrl: null, mediaType: null };
    }
    const previousNodeId = navigationStack[navigationStack.length - 1];
    const newStack = navigationStack.slice(0, -1);
    const previousNode = await getNode(ownerId, previousNodeId);
    if (!previousNode) {
      const rootNode = await getRootNode(ownerId);
      await setSession(ownerId, chatId, { currentNodeId: rootNode?.id || null, navigationStack: [] });
      return { text: buildNodeMessage(rootNode), mediaUrl: null, mediaType: null };
    }
    await setSession(ownerId, chatId, { currentNodeId: previousNodeId, navigationStack: newStack });
    return { text: buildNodeMessage(previousNode, newStack.length > 0), mediaUrl: null, mediaType: null };
  }

  // ── 5. Selección numérica ─────────────────────────────────────────────────────
  const selectedIndex = parseInt(input, 10) - 1;
  if (!isNaN(selectedIndex) && selectedIndex >= 0) {
    const options = (currentNode.options || []).sort((a, b) => a.order - b.order);
    const selected = options[selectedIndex];

    if (!selected) {
      return {
        text: `⚠️ Opción no válida. Por favor elige un número del *1* al *${options.length}*.\n\n_Escribe *0* para volver al inicio._`,
        mediaUrl: null,
        mediaType: null
      };
    }

    // Si la opción apunta a otro nodo → navegar
    if (selected.nextNodeId) {
      const nextNode = await getNode(ownerId, selected.nextNodeId);
      if (!nextNode) {
        return {
          text: `⚠️ Este contenido no está disponible aún.\n\n_Escribe *0* para volver al inicio._`,
          mediaUrl: null,
          mediaType: null
        };
      }

      const newStack = [...navigationStack, currentNodeId];
      await setSession(ownerId, chatId, { currentNodeId: nextNode.id, navigationStack: newStack });

      // Nodo tipo response → devolver contenido directo
      if (nextNode.type === 'response') {
        const responseText = nextNode.message || '';
        const haMedia = nextNode.responseType && nextNode.responseType !== 'text';

        let finalText = responseText;
        if (!haMedia) {
          finalText += '\n\n_Escribe *0* para volver al inicio o *#* para volver atrás._';
        } else if (nextNode.responseType === 'link') {
          finalText += `\n\n🔗 ${nextNode.responseContent}\n\n_Escribe *0* para volver al inicio._`;
        }

        return {
          text: finalText,
          mediaUrl: haMedia && nextNode.responseType !== 'link' ? nextNode.responseContent : null,
          mediaType: haMedia && nextNode.responseType !== 'link' ? nextNode.responseType : null
        };
      }

      // Nodo tipo menu o content → mostrar mensaje + opciones
      return {
        text: buildNodeMessage(nextNode, navigationStack.length > 0),
        mediaUrl: null,
        mediaType: null
      };
    }

    // Opción sin nextNodeId → respuesta inline (texto / media directo en la opción)
    return {
      text: `${selected.label}\n\n_Escribe *0* para volver al inicio o *#* para volver atrás._`,
      mediaUrl: null,
      mediaType: null
    };
  }

  // ── 6. Texto libre → buscar keyword match ────────────────────────────────────
  const keywords = config.keywords || [];
  const matched = keywords.find(k =>
    inputLower.includes((k.key || '').toLowerCase())
  );

  if (matched) {
    return { text: matched.response, mediaUrl: null, mediaType: null };
  }

  // ── 7. Fallback ───────────────────────────────────────────────────────────────
  const fallback = config.fallbackMessage ||
    'No entendo tu mensaje. Escribe *0* para ver el menú principal.';
  return { text: fallback, mediaUrl: null, mediaType: null };
};

module.exports = { processMessage, preloadCache, invalidateCache, buildNodeMessage };
