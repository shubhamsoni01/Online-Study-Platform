const Schedule = require('../models/Schedule');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

/**
 * Get Schedules (Filtered by caller role if teacher or student)
 * GET /api/schedules
 */
const getSchedules = async (req, res, next) => {
  try {
    const filter = {};

    // Teacher sees their own classes
    if (req.user && req.user.role === 'teacher') {
      filter.teacherId = req.user._id;
    }

    // Student sees classes for enrolled courses
    if (req.user && req.user.role === 'student') {
      const enrollments = await Enrollment.find({ studentId: req.user._id, status: 'Active' });
      const enrolledCourseIds = enrollments.map(e => e.courseId);
      filter.$or = [{ courseId: { $in: enrolledCourseIds } }, { courseId: null }];
    }

    const schedules = await Schedule.find(filter)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name photo department')
      .populate('courseId', 'title courseCode')
      .sort({ date: 1, startTime: 1 });

    const result = schedules.map(s => ({
      _id: s._id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      topic: s.topic,
      classType: s.classType,
      status: s.status,
      subjectName: s.subjectId ? s.subjectId.name : 'Curriculum Subject',
      subjectCode: s.subjectId ? s.subjectId.code : '',
      teacherName: s.teacherId ? s.teacherId.name : 'Faculty Member',
      teacherPhoto: s.teacherId ? s.teacherId.photo : '',
      courseTitle: s.courseId ? s.courseId.title : '',
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Schedule Entry (Admin only)
 * POST /api/schedules
 */
const createSchedule = async (req, res, next) => {
  try {
    const { subjectId, teacherId, courseId, date, startTime, endTime, topic, classType } = req.body;

    if (!subjectId || !teacherId || !date || !startTime || !topic) {
      return res.status(400).json({
        success: false,
        message: 'Subject, teacher, date, start time, and topic are required fields',
      });
    }

    const schedule = await Schedule.create({
      subjectId,
      teacherId,
      courseId: courseId || null,
      date,
      startTime,
      endTime: endTime || '',
      topic: topic.trim(),
      classType: classType || 'Lecture',
      status: 'Scheduled',
    });

    res.status(201).json({
      success: true,
      message: 'Class schedule saved successfully',
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Schedule Entry (Admin only)
 * PUT /api/schedules/:id
 */
const updateSchedule = async (req, res, next) => {
  try {
    const { subjectId, teacherId, courseId, date, startTime, endTime, topic, classType, status } = req.body;
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule entry not found' });
    }

    if (subjectId) schedule.subjectId = subjectId;
    if (teacherId) schedule.teacherId = teacherId;
    if (courseId !== undefined) schedule.courseId = courseId;
    if (date) schedule.date = date;
    if (startTime) schedule.startTime = startTime;
    if (endTime !== undefined) schedule.endTime = endTime;
    if (topic) schedule.topic = topic.trim();
    if (classType) schedule.classType = classType;
    if (status) schedule.status = status;

    await schedule.save();

    res.json({ success: true, message: 'Schedule updated successfully', data: schedule });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Schedule Entry (Admin only)
 * DELETE /api/schedules/:id
 */
const deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule entry not found' });
    }

    await schedule.deleteOne();
    res.json({ success: true, message: 'Schedule entry deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
