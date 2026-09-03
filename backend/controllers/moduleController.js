const Module = require('../models/Module');
const Video = require('../models/Video');
const Note = require('../models/Note');
const Quiz = require('../models/Quiz');
const TeacherAllocation = require('../models/TeacherAllocation');

/**
 * Get Modules for a Course or Subject
 * GET /api/modules?courseId=... or ?subjectId=...
 */
const getModules = async (req, res, next) => {
  try {
    const courseId = req.query.courseId || req.params.courseId;
    const subjectId = req.query.subjectId || req.params.subjectId;
    const filter = { status: 'Active' };

    if (courseId) {
      filter.$or = [
        { courseId: courseId },
        { subjectId: courseId },
      ];
    } else if (subjectId) {
      filter.subjectId = subjectId;
    }

    const modules = await Module.find(filter).sort({ order: 1 });
    const moduleIds = modules.map(m => m._id);

    const [videos, notes, quizzes] = await Promise.all([
      Video.find({ moduleId: { $in: moduleIds }, status: 'Published' }),
      Note.find({ moduleId: { $in: moduleIds }, status: 'Published' }),
      Quiz.find({ moduleId: { $in: moduleIds }, status: 'Published' }),
    ]);

    const result = modules.map(m => ({
      ...m.toObject(),
      videos: videos.filter(v => v.moduleId.toString() === m._id.toString()),
      notes: notes.filter(n => n.moduleId.toString() === m._id.toString()),
      quizzes: quizzes.filter(q => q.moduleId.toString() === m._id.toString()),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Module (Teacher only - must be assigned to subject/course)
 * POST /api/modules
 */
const createModule = async (req, res, next) => {
  try {
    const { courseId, subjectId, title, description, plannedClasses, expectedLectures, order } = req.body;
    // Authenticated identity is priority from JWT
    const teacherId = (req.user && req.user._id) ? req.user._id : (req.body.teacherId || null);

    if (!title) {
      return res.status(400).json({ success: false, message: 'Module title is required' });
    }

    // Determine target courseId and subjectId
    let targetCourseId = courseId;
    let targetSubjectId = subjectId;

    const Course = require('../models/Course');
    const Subject = require('../models/Subject');
    const TeacherAllocation = require('../models/TeacherAllocation');

    if (!targetCourseId && targetSubjectId) {
      let course = await Course.findOne({ subjectId: targetSubjectId });
      if (!course) {
        const sub = await Subject.findById(targetSubjectId);
        course = await Course.create({
          title: sub ? sub.name : 'Curriculum Course',
          courseCode: sub ? sub.code : 'CS101',
          subjectId: targetSubjectId,
          semester: sub ? sub.semester : '1st Semester',
        });
      }
      targetCourseId = course._id;
    } else if (targetCourseId && !targetSubjectId) {
      const course = await Course.findById(targetCourseId);
      if (course && course.subjectId) {
        targetSubjectId = course.subjectId;
      }
    }

    // Authorization: Verify TeacherAllocation for assigned teacher
    if (req.user && req.user.role === 'teacher') {
      const allocation = await TeacherAllocation.findOne({
        teacherId: req.user._id,
        $or: [
          { subjectId: targetSubjectId },
          { courseId: targetCourseId },
        ],
        status: 'Active',
      });

      if (!allocation) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not assigned to this subject/course',
        });
      }
    }

    // Determine module order
    const existingCount = await Module.countDocuments({ courseId: targetCourseId });
    const moduleOrder = order || existingCount + 1;

    const newModule = await Module.create({
      courseId: targetCourseId,
      subjectId: targetSubjectId || null,
      teacherId,
      title: title.trim(),
      description: description ? description.trim() : '',
      plannedClasses: parseInt(plannedClasses || expectedLectures) || 4,
      order: moduleOrder,
    });

    res.status(201).json({
      success: true,
      message: 'Module created successfully',
      data: newModule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Module
 * PUT /api/modules/:id
 */
const updateModule = async (req, res, next) => {
  try {
    const { title, description, plannedClasses, expectedLectures, order, status } = req.body;
    const moduleItem = await Module.findById(req.params.id);

    if (!moduleItem) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    // Authorization check
    if (req.user.role === 'teacher' && moduleItem.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own modules' });
    }

    if (title) moduleItem.title = title.trim();
    if (description !== undefined) moduleItem.description = description.trim();
    if (plannedClasses !== undefined || expectedLectures !== undefined) {
      moduleItem.plannedClasses = parseInt(plannedClasses || expectedLectures) || 1;
    }
    if (order !== undefined) moduleItem.order = parseInt(order);
    if (status) moduleItem.status = status;

    await moduleItem.save();

    res.json({
      success: true,
      message: 'Module updated successfully',
      data: moduleItem,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Module
 * DELETE /api/modules/:id
 */
const deleteModule = async (req, res, next) => {
  try {
    const moduleItem = await Module.findById(req.params.id);

    if (!moduleItem) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    if (req.user.role === 'teacher' && moduleItem.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own modules' });
    }

    await Video.deleteMany({ moduleId: moduleItem._id });
    await Note.deleteMany({ moduleId: moduleItem._id });
    await Quiz.deleteMany({ moduleId: moduleItem._id });
    await moduleItem.deleteOne();

    res.json({ success: true, message: 'Module and associated contents deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Reorder Modules
 * POST /api/modules/reorder
 * Body: { moduleOrders: [{ id, order }] }
 */
const reorderModules = async (req, res, next) => {
  try {
    const { moduleOrders } = req.body;
    if (!Array.isArray(moduleOrders)) {
      return res.status(400).json({ success: false, message: 'moduleOrders array is required' });
    }

    await Promise.all(
      moduleOrders.map(item => Module.findByIdAndUpdate(item.id, { order: item.order }))
    );

    res.json({ success: true, message: 'Modules reordered successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getModules,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
};
