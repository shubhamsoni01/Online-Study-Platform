const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getEnrollmentAnalysis,
  changePassword,
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

router.use(protect, adminOnly);

router.get('/stats', getDashboardStats);
router.get('/enrollment-analysis', getEnrollmentAnalysis);
router.post('/change-password', changePassword);
router.route('/').get(getAdmins).post(createAdmin);
router.route('/:id').put(updateAdmin).delete(deleteAdmin);

module.exports = router;

