const Progress = require('../models/Progress');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Video = require('../models/Video');

/**
 * Mark Video or Module Progress / Completion
 * POST /api/progress/video or POST /api/progress
 * Body: { courseId, moduleId, videoId, watchedSeconds, duration, percentage, completed }
 */
const updateProgress = async (req, res, next) => {
  try {
    const {
      courseId,
      moduleId,
      videoId,
      watchedSeconds = 0,
      duration = 0,
      percentage = 0,
      completed,
    } = req.body;
    const studentId = req.user._id;

    if (!courseId || !moduleId) {
      return res.status(400).json({ success: false, message: 'courseId and moduleId are required' });
    }

    // Auto-complete if watched >= 90% or explicitly marked completed
    const isCompleted = completed === true || percentage >= 90 || (duration > 0 && watchedSeconds >= duration * 0.9);

    const updateData = {
      studentId,
      courseId,
      moduleId,
      videoId: videoId || null,
      watchedSeconds: Math.round(Number(watchedSeconds) || 0),
      duration: Math.round(Number(duration) || 0),
      percentage: Math.min(100, Math.round(Number(percentage) || 0)),
      lastWatchedAt: new Date(),
    };

    if (isCompleted) {
      updateData.completed = true;
      updateData.completedAt = new Date();
    } else if (completed === false) {
      updateData.completed = false;
      updateData.completedAt = null;
    }

    const progress = await Progress.findOneAndUpdate(
      { studentId, courseId, moduleId, videoId: videoId || null },
      { $set: updateData },
      { upsert: true, new: true }
    );

    // Calculate updated course progress
    const [videos, progressRecords] = await Promise.all([
      Video.find({ courseId, status: 'Published' }),
      Progress.find({ studentId, courseId, completed: true }),
    ]);

    const totalLectures = videos.length || 1;
    const completedCount = progressRecords.length;
    const coursePercentage = videos.length > 0
      ? Math.min(100, Math.round((completedCount / totalLectures) * 100))
      : 0;

    res.json({
      success: true,
      message: isCompleted ? 'Lecture marked as completed!' : 'Playback progress updated',
      data: {
        progress,
        coursePercentage,
        completedCount,
        totalLectures,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Course Progress Summary for Student
 * GET /api/progress/:courseId
 */
const getCourseProgress = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const { courseId } = req.params;

    const course = await Course.findById(courseId);

    const [modules, videos, progressRecords] = await Promise.all([
      Module.find({
        $or: [
          { courseId },
          ...(course && course.subjectId ? [{ subjectId: course.subjectId }] : []),
        ],
        status: 'Active',
      }),
      Video.find({
        $or: [
          { courseId },
          ...(course && course.subjectId ? [{ subjectId: course.subjectId }] : []),
        ],
        status: 'Published',
      }),
      Progress.find({ studentId, courseId, completed: true }),
    ]);

    const totalLectures = videos.length;
    const completedCount = progressRecords.length;
    const percentage = totalLectures > 0
      ? Math.min(100, Math.round((completedCount / totalLectures) * 100))
      : 0;

    res.json({
      success: true,
      data: {
        courseId,
        totalModules: modules.length,
        totalLectures,
        completedCount,
        percentage,
        completedVideoIds: progressRecords.map(p => p.videoId?.toString()).filter(Boolean),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProgress,
  getCourseProgress,
};
