const express = require('express');
const router = express.Router();
const {
  getCourses,
  getCourseById,
  getCourseContent,
  createCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/courseController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

// Optional auth for reading (to know student enrollment), required for modifications
router.get('/', (req, res, next) => {
  if (req.headers.authorization) return protect(req, res, next);
  next();
}, getCourses);

router.get('/:id', protect, getCourseById);
router.get('/:id/content', protect, getCourseContent);
router.post('/', protect, adminOnly, createCourse);
router.put('/:id', protect, adminOnly, updateCourse);
router.delete('/:id', protect, adminOnly, deleteCourse);

module.exports = router;
