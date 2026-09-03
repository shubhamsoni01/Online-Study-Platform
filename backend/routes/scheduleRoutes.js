const express = require('express');
const router = express.Router();
const {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/scheduleController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

router.use(protect);

router.route('/')
  .get(getSchedules)
  .post(adminOnly, createSchedule);

router.route('/:id')
  .put(adminOnly, updateSchedule)
  .delete(adminOnly, deleteSchedule);

module.exports = router;
