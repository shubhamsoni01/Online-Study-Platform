const express = require('express');
const router = express.Router();
const {
  submitQuizAttempt,
  getMyAttempts,
  getAttemptById,
  getTeacherQuizResults,
} = require('../controllers/quizAttemptController');
const { protect } = require('../middleware/authMiddleware');
const { studentOnly, staffOnly } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/', studentOnly, submitQuizAttempt);
router.get('/my-attempts', studentOnly, getMyAttempts);
router.get('/teacher-results', staffOnly, getTeacherQuizResults);
router.get('/teacher/results', staffOnly, getTeacherQuizResults);
router.get('/:id', getAttemptById);

module.exports = router;

