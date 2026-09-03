const express = require('express');
const router = express.Router();
const {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
} = require('../controllers/subjectController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

router.use(protect);

router.route('/')
  .get(getSubjects)
  .post(adminOnly, createSubject);

router.route('/:id')
  .get(getSubjectById)
  .put(adminOnly, updateSubject)
  .delete(adminOnly, deleteSubject);

module.exports = router;
