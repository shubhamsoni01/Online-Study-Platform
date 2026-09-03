const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Video = require('../models/Video');
const Note = require('../models/Note');
const Quiz = require('../models/Quiz');
const TeacherAllocation = require('../models/TeacherAllocation');
const Progress = require('../models/Progress');

/**
 * Enroll Student in a Course
 * POST /api/enrollments
 * Body: { courseId }
 */
const enrollInCourse = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user._id;

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'courseId is required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check if already enrolled
    const existing = await Enrollment.findOne({ studentId, courseId });
    if (existing) {
      return res.status(200).json({
        success: true,
        alreadyEnrolled: true,
        message: 'You are already enrolled in this course',
        data: existing,
      });
    }

    const enrollment = await Enrollment.create({
      studentId,
      courseId,
      enrolledAt: new Date(),
      status: 'Active',
    });

    res.status(201).json({
      success: true,
      message: `Successfully enrolled in ${course.title}!`,
      data: enrollment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get My Enrolled Courses (Student Dashboard)
 * GET /api/enrollments/my-courses
 */
const getMyEnrolledCourses = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const enrollments = await Enrollment.find({ studentId, status: 'Active' })
      .populate({
        path: 'courseId',
        populate: { path: 'subjectId', select: 'name code semester' },
      })
      .sort({ enrolledAt: -1 });

    const courseIds = enrollments.map(e => e.courseId?._id).filter(Boolean);
    const subjectIds = enrollments.map(e => e.courseId?.subjectId?._id || e.courseId?.subjectId).filter(Boolean);

    // Compute progress for each enrolled course
    const [allModules, allVideos, allNotes, allQuizzes, allProgress, allAllocations] = await Promise.all([
      Module.find({
        $or: [
          { courseId: { $in: courseIds } },
          { subjectId: { $in: subjectIds } },
        ],
        status: { $ne: 'Archived' },
      }),
      Video.find({
        $or: [
          { courseId: { $in: courseIds } },
          { subjectId: { $in: subjectIds } },
        ],
        status: 'Published',
      }),
      Note.find({
        $or: [
          { courseId: { $in: courseIds } },
          { subjectId: { $in: subjectIds } },
        ],
        status: 'Published',
      }),
      Quiz.find({
        $or: [
          { courseId: { $in: courseIds } },
          { subjectId: { $in: subjectIds } },
        ],
        status: 'Published',
      }),
      Progress.find({ studentId, completed: true }),
      TeacherAllocation.find({ status: 'Active' }).populate('teacherId', 'name photo department'),
    ]);

    const result = enrollments.map(e => {
      const c = e.courseId;
      if (!c) return null;

      const cId = c._id.toString();
      const sId = c.subjectId?._id?.toString() || c.subjectId?.toString();

      const cModules = allModules.filter(m =>
        (m.courseId && m.courseId.toString() === cId) ||
        (sId && m.subjectId && m.subjectId.toString() === sId)
      );
      const modIds = cModules.map(m => m._id.toString());

      const cVideos = allVideos.filter(v =>
        (v.courseId && v.courseId.toString() === cId) ||
        (sId && v.subjectId && v.subjectId.toString() === sId) ||
        (v.moduleId && modIds.includes(v.moduleId.toString()))
      );

      const cNotes = allNotes.filter(n =>
        (n.courseId && n.courseId.toString() === cId) ||
        (sId && n.subjectId && n.subjectId.toString() === sId) ||
        (n.moduleId && modIds.includes(n.moduleId.toString()))
      );

      const cQuizzes = allQuizzes.filter(q =>
        (q.courseId && q.courseId.toString() === cId) ||
        (sId && q.subjectId && q.subjectId.toString() === sId) ||
        (q.moduleId && modIds.includes(q.moduleId.toString()))
      );

      const videoIds = cVideos.map(v => v._id.toString());
      const cCompleted = allProgress.filter(p =>
        (p.courseId && p.courseId.toString() === cId) ||
        (p.videoId && videoIds.includes(p.videoId.toString()))
      );

      // Progress calculation based on published video lectures
      const totalLectures = cVideos.length;
      const completedCount = cCompleted.length;
      const progressPercent = totalLectures > 0
        ? Math.min(100, Math.round((completedCount / totalLectures) * 100))
        : 0;

      const primaryTeacher = allAllocations.find(
        a => (a.courseId && a.courseId.toString() === cId) ||
             (a.subjectId && sId && a.subjectId.toString() === sId)
      )?.teacherId || null;

      return {
        enrollmentId: e._id,
        _id: e._id,
        enrolledAt: e.enrolledAt,
        course: {
          _id: c._id,
          id: c._id,
          title: c.title,
          courseCode: c.courseCode,
          semester: c.semester,
          subject: c.subjectId,
          modulesCount: cModules.length,
          lecturesCount: cVideos.length,
          notesCount: cNotes.length,
          quizzesCount: cQuizzes.length,
          completedLectures: completedCount,
          primaryTeacher,
        },
        modulesCount: cModules.length,
        lecturesCount: cVideos.length,
        notesCount: cNotes.length,
        quizzesCount: cQuizzes.length,
        completedLectures: completedCount,
        primaryTeacher,
        progressPercentage: progressPercent,
      };
    }).filter(Boolean);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if Student is Enrolled in a Specific Course
 * GET /api/enrollments/check/:courseId
 */
const checkEnrollment = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const enrollment = await Enrollment.findOne({
      studentId,
      courseId: req.params.courseId,
      status: 'Active',
    });

    res.json({
      success: true,
      data: { isEnrolled: !!enrollment, enrollment },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  enrollInCourse,
  getMyEnrolledCourses,
  checkEnrollment,
};
