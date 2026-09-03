const express = require('express');
const router = express.Router();
const {
  enrollInCourse,
  getMyEnrolledCourses,
  checkEnrollment,
} = require('../controllers/enrollmentController');
const { protect } = require('../middleware/authMiddleware');
const { studentOnly } = require('../middleware/roleMiddleware');

router.use(protect, studentOnly);

router.post('/', enrollInCourse);
router.get('/my-courses', getMyEnrolledCourses);
router.get('/check/:courseId', checkEnrollment);

module.exports = router;
