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
  uploadStudentPhoto,
} = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/me', getStudentProfileMe);
router.put('/me', upload.single('photo'), updateStudentProfileMe);
router.post('/me/photo', upload.single('photo'), uploadStudentPhoto);

router.route('/')
  .get(adminOnly, getStudents)
  .post(adminOnly, createStudent);

router.route('/:id')
  .get(getStudentById)
  .put(updateStudent)
  .delete(adminOnly, deleteStudent);

module.exports = router;
