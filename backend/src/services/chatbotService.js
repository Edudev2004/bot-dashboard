const { db } = require('../config/firebaseConfig');

const NODES_COLLECTION = 'chatbot_nodes';
const OPTIONS_COLLECTION = 'chatbot_options';
const CONFIG_COLLECTION  = 'bot_general_config';

// ─── NODOS ────────────────────────────────────────────────────────────────────

/**
 * Obtiene TODOS los nodos y sus opciones de un cliente.
 * Devuelve un array plano; el árbol se construye en el cliente o en el engine.
 */
const getAllNodes = async (ownerId) => {
  const nodesSnap = await db.collection(NODES_COLLECTION)
    .where('ownerId', '==', ownerId)
    .get();

  const nodes = [];
  for (const doc of nodesSnap.docs) {
    const nodeData = { id: doc.id, ...doc.data() };
    const optsSnap = await db.collection(OPTIONS_COLLECTION)
      .where('nodeId', '==', doc.id)
      .orderBy('order')
      .get();
    nodeData.options = optsSnap.docs.map(o => ({ id: o.id, ...o.data() }));
    nodes.push(nodeData);
  }
  return nodes;
};

/**
 * Construye el árbol jerárquico a partir de los nodos planos.
 */
const buildTree = (nodes) => {
  const map = {};
  nodes.forEach(n => { map[n.id] = { ...n, children: [] }; });

  const roots = [];
  nodes.forEach(n => {
    if (n.parentNodeId && map[n.parentNodeId]) {
      map[n.parentNodeId].children.push(map[n.id]);
    } else if (n.isRoot) {
      roots.unshift(map[n.id]); // root siempre primero
    } else if (!n.parentNodeId) {
      roots.push(map[n.id]);
    }
  });
  return roots;
};

/**
 * Obtiene el árbol completo del chatbot para un cliente.
 */
const getChatbotTree = async (ownerId) => {
  const nodes = await getAllNodes(ownerId);
  return buildTree(nodes);
};

/**
 * Obtiene un nodo por ID con sus opciones.
 */
const getNodeById = async (nodeId) => {
  const doc = await db.collection(NODES_COLLECTION).doc(nodeId).get();
  if (!doc.exists) return null;
  const nodeData = { id: doc.id, ...doc.data() };

  const optsSnap = await db.collection(OPTIONS_COLLECTION)
    .where('nodeId', '==', nodeId)
    .orderBy('order')
    .get();
  nodeData.options = optsSnap.docs.map(o => ({ id: o.id, ...o.data() }));
  return nodeData;
};

/**
 * Obtiene el nodo raíz de un cliente con sus opciones.
 */
const getRootNode = async (ownerId) => {
  const snap = await db.collection(NODES_COLLECTION)
    .where('ownerId', '==', ownerId)
    .where('isRoot', '==', true)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  const nodeData = { id: doc.id, ...doc.data() };

  const optsSnap = await db.collection(OPTIONS_COLLECTION)
    .where('nodeId', '==', doc.id)
    .orderBy('order')
    .get();
  nodeData.options = optsSnap.docs.map(o => ({ id: o.id, ...o.data() }));
  return nodeData;
};

/**
 * Crea o actualiza un nodo. Si tiene opciones, las reemplaza en batch.
 * Campos soportados:
 *   type: "menu" | "content" | "response"
 *   message: string
 *   isRoot: boolean
 *   parentNodeId: string | null
 *   responseType: "text" | "image" | "pdf" | "link" | null
 *   responseContent: string | null  (URL o texto)
 *   options: [{ label, nextNodeId, order }]
 */
const saveNode = async (ownerId, nodeData) => {
  const { id, options, ...data } = nodeData;

  const nodeRef = id
    ? db.collection(NODES_COLLECTION).doc(id)
    : db.collection(NODES_COLLECTION).doc();
  const nodeId = nodeRef.id;

  // Si este nodo es root, desmarcar cualquier otro root anterior
  if (data.isRoot) {
    const existingRoots = await db.collection(NODES_COLLECTION)
      .where('ownerId', '==', ownerId)
      .where('isRoot', '==', true)
      .get();
    const rootBatch = db.batch();
    existingRoots.forEach(doc => {
      if (doc.id !== nodeId) rootBatch.update(doc.ref, { isRoot: false });
    });
    await rootBatch.commit();
  }

  await nodeRef.set(
    {
      ...data,
      ownerId,
      responseType: data.responseType || null,
      responseContent: data.responseContent || null,
      parentNodeId: data.parentNodeId || null,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  // Reemplazar opciones si se proporcionaron
  if (Array.isArray(options)) {
    const batch = db.batch();
    const existing = await db.collection(OPTIONS_COLLECTION)
      .where('nodeId', '==', nodeId)
      .get();
    existing.forEach(doc => batch.delete(doc.ref));

    options.forEach((opt, idx) => {
      const optRef = db.collection(OPTIONS_COLLECTION).doc();
      batch.set(optRef, {
        nodeId,
        label: opt.label,
        nextNodeId: opt.nextNodeId || null,
        order: opt.order !== undefined ? opt.order : idx
      });
    });
    await batch.commit();
  }

  return nodeId;
};

/**
 * Elimina un nodo, sus opciones salientes y nullifica referencias a él.
 */
const deleteNode = async (nodeId) => {
  const batch = db.batch();
  batch.delete(db.collection(NODES_COLLECTION).doc(nodeId));

  const options = await db.collection(OPTIONS_COLLECTION)
    .where('nodeId', '==', nodeId)
    .get();
  options.forEach(doc => batch.delete(doc.ref));

  const pointing = await db.collection(OPTIONS_COLLECTION)
    .where('nextNodeId', '==', nodeId)
    .get();
  pointing.forEach(doc => batch.update(doc.ref, { nextNodeId: null }));

  await batch.commit();
};

// ─── CONFIGURACIÓN GENERAL ───────────────────────────────────────────────────

/**
 * Obtiene la configuración general del bot (saludo, fallback, keywords).
 */
const getChatbotGeneralConfig = async (ownerId) => {
  const doc = await db.collection(CONFIG_COLLECTION).doc(ownerId).get();
  if (!doc.exists) {
    return {
      ownerId,
      greeting: '¡Hola! 👋 ¿En qué podemos ayudarte hoy?',
      fallbackMessage: 'No entiendo tu consulta. Escribe *0* para volver al inicio.',
      keywords: []
    };
  }
  return { id: doc.id, ...doc.data() };
};

/**
 * Guarda o actualiza la configuración general del bot.
 */
const setChatbotGeneralConfig = async (ownerId, config) => {
  const data = {
    ...config,
    ownerId,
    updatedAt: new Date().toISOString()
  };
  await db.collection(CONFIG_COLLECTION).doc(ownerId).set(data, { merge: true });
  return data;
};

module.exports = {
  getAllNodes,
  getChatbotTree,
  getNodeById,
  getRootNode,
  saveNode,
  deleteNode,
  getChatbotGeneralConfig,
  setChatbotGeneralConfig,
  buildTree
};
