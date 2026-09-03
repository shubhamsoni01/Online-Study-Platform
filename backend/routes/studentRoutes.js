const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentProfileMe,
  updateStudentProfileMe,
} = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/me', getStudentProfileMe);
router.put('/me', updateStudentProfileMe);

router.route('/')
  .get(adminOnly, getStudents)
  .post(adminOnly, createStudent);

router.route('/:id')
  .get(getStudentById)
  .put(updateStudent)
  .delete(adminOnly, deleteStudent);

module.exports = router;
