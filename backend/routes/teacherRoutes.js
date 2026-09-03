const express = require('express');
const router = express.Router();
const {
  getTeachers,
  getTeacherById,
  getTeacherProfileMe,
  createTeacher,
  updateTeacher,
  toggleTeacherStatus,
  deleteTeacher,
  getTeacherDashboardStats,
  getMyAssignedSubjects,
  getTeacherAllocations,
} = require('../controllers/teacherController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, teacherOnly, staffOnly } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

// Teacher's own isolated routes
router.get('/me', teacherOnly, getTeacherProfileMe);
router.get('/me/allocations', teacherOnly, getTeacherAllocations);
router.get('/dashboard/my-stats', teacherOnly, getTeacherDashboardStats);
router.get('/my-subjects', teacherOnly, getMyAssignedSubjects);
router.get('/:teacherId/allocations', staffOnly, getTeacherAllocations);

// Admin-managed teacher routes
router.route('/')
  .get(staffOnly, getTeachers)
  .post(adminOnly, upload.single('photo'), createTeacher);

router.route('/:id')
  .get(staffOnly, getTeacherById)
  .put(adminOnly, upload.single('photo'), updateTeacher)
  .delete(adminOnly, deleteTeacher);

router.patch('/:id/status', adminOnly, toggleTeacherStatus);

module.exports = router;
