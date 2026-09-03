const express = require('express');
const router = express.Router();
const {
  getModules,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
} = require('../controllers/moduleController');
const { protect } = require('../middleware/authMiddleware');
const { staffOnly } = require('../middleware/roleMiddleware');

router.use(protect);

router.route('/')
  .get(getModules)
  .post(staffOnly, createModule);

router.get('/course/:courseId', getModules);
router.get('/subject/:subjectId', getModules);

router.post('/reorder', staffOnly, reorderModules);

router.route('/:id')
  .put(staffOnly, updateModule)
  .delete(staffOnly, deleteModule);

module.exports = router;
