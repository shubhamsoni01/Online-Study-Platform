const express = require('express');
const router = express.Router();
const { updateProgress, getCourseProgress } = require('../controllers/progressController');
const { protect } = require('../middleware/authMiddleware');
const { studentOnly } = require('../middleware/roleMiddleware');

router.use(protect, studentOnly);

router.post('/', updateProgress);
router.post('/video', updateProgress);
router.get('/:courseId', getCourseProgress);

module.exports = router;
