const express = require('express');
const router = express.Router();
const {
  getBooks,
  createBook,
  deleteBook,
} = require('../controllers/bookController');
const { protect } = require('../middleware/authMiddleware');
const { teacherOnly } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', getBooks);
router.post('/', teacherOnly, upload.single('file'), createBook);
router.delete('/:id', teacherOnly, deleteBook);

module.exports = router;
