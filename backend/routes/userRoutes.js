const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  assignTeacher,
  makeAdmin,
  removeTeacher,
  removeAdmin,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect, adminOnly);

router.get('/', getAllUsers);
router.post('/assign-teacher', upload.single('photo'), assignTeacher);
router.post('/make-admin', makeAdmin);
router.post('/remove-teacher', removeTeacher);
router.post('/remove-admin', removeAdmin);

module.exports = router;
