const { db } = require('../config/firebaseConfig');
const NODES_COLLECTION = 'chatbot_nodes';
const OPTIONS_COLLECTION = 'chatbot_options';

/**
 * Get all nodes for a specific owner, including their options
 */
const getFullChatbotTree = async (ownerId) => {
  const nodesSnapshot = await db.collection(NODES_COLLECTION)
    .where('ownerId', '==', ownerId)
    .get();
  
  const nodes = [];
  for (const doc of nodesSnapshot.docs) {
    const nodeData = { id: doc.id, ...doc.data() };
    const optionsSnapshot = await db.collection(OPTIONS_COLLECTION)
      .where('nodeId', '==', doc.id)
      .orderBy('order')
      .get();
    
    nodeData.options = optionsSnapshot.docs.map(o => ({ id: o.id, ...o.data() }));
    nodes.push(nodeData);
  }
  return nodes;
};

/**
 * Save or Update a Node
 */
const saveNode = async (ownerId, nodeData) => {
  const { id, options, ...data } = nodeData;
  
  let nodeId = id;
  const nodeRef = id ? db.collection(NODES_COLLECTION).doc(id) : db.collection(NODES_COLLECTION).doc();
  nodeId = nodeRef.id;

  // If this node is set as root, unset others
  if (data.isRoot) {
    const roots = await db.collection(NODES_COLLECTION)
      .where('ownerId', '==', ownerId)
      .where('isRoot', '==', true)
      .get();
    const batch = db.batch();
    roots.forEach(doc => {
      if (doc.id !== nodeId) batch.update(doc.ref, { isRoot: false });
    });
    await batch.commit();
  }

  await nodeRef.set({ ...data, ownerId, updatedAt: new Date() }, { merge: true });

  // Save options if provided
  if (options && Array.isArray(options)) {
    const batch = db.batch();
    // Delete existing options for this node first to simplify
    const existingOptions = await db.collection(OPTIONS_COLLECTION).where('nodeId', '==', nodeId).get();
    existingOptions.forEach(doc => batch.delete(doc.ref));
    
    options.forEach((opt, idx) => {
      const optRef = db.collection(OPTIONS_COLLECTION).doc();
      batch.set(optRef, {
        nodeId,
        label: opt.label,
        nextNodeId: opt.nextNodeId || null,
        order: opt.order || idx
      });
    });
    await batch.commit();
  }

  return nodeId;
};

/**
 * Delete a Node and its outbound options
 */
const deleteNode = async (nodeId) => {
  const batch = db.batch();
  batch.delete(db.collection(NODES_COLLECTION).doc(nodeId));
  
  const options = await db.collection(OPTIONS_COLLECTION).where('nodeId', '==', nodeId).get();
  options.forEach(doc => batch.delete(doc.ref));

  // Also nullify any options pointing to this node
  const pointingOptions = await db.collection(OPTIONS_COLLECTION).where('nextNodeId', '==', nodeId).get();
  pointingOptions.forEach(doc => batch.update(doc.ref, { nextNodeId: null }));

  await batch.commit();
};

/**
 * Get Root Node for navigation
 */
const getRootNode = async (ownerId) => {
  const snapshot = await db.collection(NODES_COLLECTION)
    .where('ownerId', '==', ownerId)
    .where('isRoot', '==', true)
    .limit(1)
    .get();
    
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const nodeData = { id: doc.id, ...doc.data() };
  
  const optionsSnapshot = await db.collection(OPTIONS_COLLECTION)
    .where('nodeId', '==', doc.id)
    .orderBy('order')
    .get();
    
  nodeData.options = optionsSnapshot.docs.map(o => ({ id: o.id, ...o.data() }));
  return nodeData;
};

/**
 * Get specific node by ID
 */
const getNodeById = async (nodeId) => {
  const doc = await db.collection(NODES_COLLECTION).doc(nodeId).get();
  if (!doc.exists) return null;
  const nodeData = { id: doc.id, ...doc.data() };
  
  const optionsSnapshot = await db.collection(OPTIONS_COLLECTION)
    .where('nodeId', '==', nodeId)
    .orderBy('order')
    .get();
    
  nodeData.options = optionsSnapshot.docs.map(o => ({ id: o.id, ...o.data() }));
  return nodeData;
};

module.exports = {
  getFullChatbotTree,
  saveNode,
  deleteNode,
  getRootNode,
  getNodeById
};
