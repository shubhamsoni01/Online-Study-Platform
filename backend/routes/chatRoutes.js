const express = require('express');
const router = express.Router();
const {
  getRoomMessages,
  sendRoomMessage,
  deleteRoomMessage,
  getConversation,
  sendMessage,
  getChatContacts,
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// 2-Box Room Chat Endpoints
router.get('/rooms/:room', getRoomMessages);
router.post('/rooms/:room', sendRoomMessage);
router.delete('/messages/:id', deleteRoomMessage);

// Direct 1-on-1 and Contacts Endpoints
router.get('/contacts', getChatContacts);
router.get('/:targetUserId', getConversation);
router.post('/', sendMessage);

module.exports = router;
