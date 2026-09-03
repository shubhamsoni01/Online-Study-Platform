const express = require('express');
const router = express.Router();
const {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require('../controllers/announcementController');
const { protect } = require('../middleware/authMiddleware');
const { teacherOnly } = require('../middleware/roleMiddleware');

router.use(protect);

router.route('/')
  .get(getAnnouncements)
  .post(teacherOnly, createAnnouncement);

router.route('/:id')
  .put(teacherOnly, updateAnnouncement)
  .delete(teacherOnly, deleteAnnouncement);

module.exports = router;
