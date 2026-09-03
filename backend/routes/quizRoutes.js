const express = require('express');
const router = express.Router();
const {
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
} = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');
const { staffOnly } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/:id', getQuizById);
router.post('/', staffOnly, createQuiz);
router.put('/:id', staffOnly, updateQuiz);
router.delete('/:id', staffOnly, deleteQuiz);

module.exports = router;
