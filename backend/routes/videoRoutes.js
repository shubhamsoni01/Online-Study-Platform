const express = require('express');
const router = express.Router();
const {
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
} = require('../controllers/videoController');
const { protect } = require('../middleware/authMiddleware');
const { staffOnly } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/:id', getVideoById);
router.post('/', staffOnly, upload.single('video'), createVideo);
router.put('/:id', staffOnly, updateVideo);
router.delete('/:id', staffOnly, deleteVideo);

module.exports = router;
