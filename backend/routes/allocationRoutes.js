const express = require('express');
const router = express.Router();
const {
  getAllocations,
  getTeacherAllocations,
  syncTeacherAllocations,
  createAllocation,
  deleteAllocation,
} = require('../controllers/allocationController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, staffOnly } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/', staffOnly, getAllocations);
router.get('/teacher/:teacherId', staffOnly, getTeacherAllocations);
router.post('/sync', adminOnly, syncTeacherAllocations);
router.post('/', adminOnly, createAllocation);
router.delete('/:id', adminOnly, deleteAllocation);

module.exports = router;
