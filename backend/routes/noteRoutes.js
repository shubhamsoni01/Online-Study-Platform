const express = require('express');
const router = express.Router();
const {
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
} = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');
const { staffOnly } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/:id', getNoteById);
router.post('/', staffOnly, upload.single('file'), createNote);
router.put('/:id', staffOnly, updateNote);
router.delete('/:id', staffOnly, deleteNote);

module.exports = router;
