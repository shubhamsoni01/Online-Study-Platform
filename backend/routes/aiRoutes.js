const express = require('express');
const router = express.Router();
const { generateQuiz, askDoubt } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');
const { teacherOnly } = require('../middleware/roleMiddleware');

// AI Quiz Generation (Faculty only)
router.post('/generate-quiz', protect, teacherOnly, generateQuiz);

// Dynamic AI Doubt Assistant for Video Lectures (Open to all authenticated students, faculty & admins)
router.post('/ask-doubt', protect, askDoubt);
router.post('/doubt', protect, askDoubt);

module.exports = router;
