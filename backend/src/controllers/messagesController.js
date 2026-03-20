const { getAllMessages } = require('../services/firestoreService');

/**
 * GET /api/messages
 * Returns all messages ordered by date descending
 */
const getMessages = async (req, res) => {
  try {
    const messages = await getAllMessages();
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('[Controller] Error fetching messages:', error.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve messages' });
  }
};

module.exports = { getMessages };
