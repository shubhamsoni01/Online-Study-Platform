const express = require('express');
const router = express.Router();
const {
  getVideoComments,
  getTeacherComments,
  addComment,
  addReply,
  deleteComment,
} = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');
const { teacherOnly } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/video/:videoId', getVideoComments);
router.get('/teacher/my-comments', teacherOnly, getTeacherComments);
router.post('/', addComment);
router.post('/:id/reply', addReply);
router.delete('/:id', deleteComment);

module.exports = router;
