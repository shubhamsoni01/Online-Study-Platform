const express = require('express');
const router = express.Router();
const {
  login,
  registerStudent,
  studentLogin,
  teacherLogin,
  getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/register', registerStudent);
router.post('/student/register', registerStudent);
router.post('/student/login', studentLogin);
router.post('/teacher/login', teacherLogin);
router.get('/me', protect, getMe);

module.exports = router;
