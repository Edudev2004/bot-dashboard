const express = require('express');
const router = express.Router();
const { getMessages } = require('../controllers/messagesController');

// GET /api/messages
router.get('/', getMessages);

module.exports = router;
