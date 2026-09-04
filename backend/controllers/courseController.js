const Course = require('../models/Course');
const Module = require('../models/Module');
const Video = require('../models/Video');
const Note = require('../models/Note');
const Quiz = require('../models/Quiz');
const TeacherAllocation = require('../models/TeacherAllocation');
const Enrollment = require('../models/Enrollment');

const Progress = require('../models/Progress');

/**
 * Get All Courses (with enrollment status for student if authenticated)
 * GET /api/courses
 */
const getCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ status: 'Active' })
      .populate('subjectId', 'name code semester')
      .sort({ createdAt: -1 });

    const courseIds = courses.map(c => c._id);
    const subjectIds = courses.map(c => c.subjectId?._id || c.subjectId).filter(Boolean);

    // Get module, video, note, and quiz counts from MongoDB collections
    const [modules, videos, notes, quizzes, allocations] = await Promise.all([
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
      TeacherAllocation.find({ status: 'Active' }).populate('teacherId', 'name photo department'),
    ]);

    // Check student enrollments if caller is student
    let studentEnrollments = [];
    if (req.user && req.user.role === 'student') {
      studentEnrollments = await Enrollment.find({ studentId: req.user._id, status: 'Active' });
    }

    const result = courses.map(c => {
      const sId = c.subjectId?._id?.toString() || c.subjectId?.toString();
      const cId = c._id.toString();

      const cModules = modules.filter(m => 
        (m.courseId && m.courseId.toString() === cId) ||
        (sId && m.subjectId && m.subjectId.toString() === sId)
      );
      const modIds = cModules.map(m => m._id.toString());

      const cVideos = videos.filter(v =>
        (v.courseId && v.courseId.toString() === cId) ||
        (sId && v.subjectId && v.subjectId.toString() === sId) ||
        (v.moduleId && modIds.includes(v.moduleId.toString()))
      );

      const cNotes = notes.filter(n =>
        (n.courseId && n.courseId.toString() === cId) ||
        (sId && n.subjectId && n.subjectId.toString() === sId) ||
        (n.moduleId && modIds.includes(n.moduleId.toString()))
      );

      const cQuizzes = quizzes.filter(q =>
        (q.courseId && q.courseId.toString() === cId) ||
        (sId && q.subjectId && q.subjectId.toString() === sId) ||
        (q.moduleId && modIds.includes(q.moduleId.toString()))
      );

      const cTeachers = allocations
        .filter(a => (a.courseId && a.courseId.toString() === cId) || (a.subjectId && sId && a.subjectId.toString() === sId))
        .map(a => a.teacherId)
        .filter(Boolean);

      const isEnrolled = studentEnrollments.some(e => e.courseId.toString() === cId);

      return {
        ...c.toObject(),
        modulesCount: cModules.length,
        lecturesCount: cVideos.length,
        notesCount: cNotes.length,
        quizzesCount: cQuizzes.length,
        teachers: cTeachers,
        primaryTeacher: cTeachers[0] || null,
        isEnrolled,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Course Content (Modules, Published Videos, Notes, Quizzes) for Student / Teacher
 * GET /api/courses/:id/content
 */
const getCourseContent = async (req, res, next) => {
  try {
    let course = await Course.findById(req.params.id).populate('subjectId');
    if (!course) {
      // Fallback: check if id is a Subject ID
      course = await Course.findOne({ subjectId: req.params.id }).populate('subjectId');
    }
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found in database' });
    }

    const isStudent = req.user && req.user.role === 'student';
    const sId = course.subjectId?._id || course.subjectId;

    // Verify enrollment for students
    if (isStudent) {
      const isEnrolled = await Enrollment.findOne({
        studentId: req.user._id,
        $or: [
          { courseId: course._id },
          ...(sId ? [{ courseId: sId }] : []),
        ],
        status: 'Active',
      });

      if (!isEnrolled) {
        return res.status(403).json({
          success: false,
          message: 'You are not enrolled in this course. Please enroll to access lectures and notes.',
        });
      }
    }

    // Fetch modules in order
    const modules = await Module.find({
      $or: [
        { courseId: course._id },
        ...(sId ? [{ subjectId: sId }] : []),
      ],
      status: { $nin: ['Archived', 'Draft'] },
    }).sort({ order: 1, createdAt: 1 });
    const moduleIds = modules.map(m => m._id);

    // Published filter condition for students
    const studentStatusCondition = isStudent ? {
      $or: [
        { status: 'Published' },
        { status: 'Active' },
        { status: { $exists: false } },
        { published: true },
        { isPublished: true },
      ],
      status: { $nin: ['Draft', 'Archived'] },
    } : {};

    // Search for materials matching any of: moduleIds, courseId, or subjectId
    const materialScope = {
      $or: [
        ...(moduleIds.length > 0 ? [{ moduleId: { $in: moduleIds } }] : []),
        { courseId: course._id },
        ...(sId ? [{ subjectId: sId }] : []),
      ],
    };

    const finalQuery = isStudent ? {
      $and: [
        materialScope,
        studentStatusCondition,
      ],
    } : materialScope;

    const [videos, notes, quizzes, allocations, progressRecords] = await Promise.all([
      Video.find(finalQuery).sort({ createdAt: 1 }),
      Note.find(finalQuery).sort({ createdAt: 1 }),
      Quiz.find(finalQuery).sort({ createdAt: 1 }),
      TeacherAllocation.find({ status: 'Active' }).populate('teacherId', 'name photo department email'),
      isStudent ? Progress.find({ studentId: req.user._id, courseId: course._id, completed: true }) : Promise.resolve([]),
    ]);

    const completedVideoIds = new Set(progressRecords.map(p => p.videoId?.toString()).filter(Boolean));

    // Track assigned IDs to catch any unassigned materials
    const assignedVideoIds = new Set();
    const assignedNoteIds = new Set();
    const assignedQuizIds = new Set();

    const structuredModules = modules.map((m, idx) => {
      const mIdStr = m._id.toString();
      const modVideos = videos.filter(v => {
        const matches = v.moduleId && v.moduleId.toString() === mIdStr;
        if (matches) assignedVideoIds.add(v._id.toString());
        return matches;
      });
      const modNotes = notes.filter(n => {
        const matches = n.moduleId && n.moduleId.toString() === mIdStr;
        if (matches) assignedNoteIds.add(n._id.toString());
        return matches;
      });
      const modQuizzes = quizzes.filter(q => {
        const matches = q.moduleId && q.moduleId.toString() === mIdStr;
        if (matches) assignedQuizIds.add(q._id.toString());
        return matches;
      });

      // If student, strip correct answers & explanations from quizzes before attempting
      const safeQuizzes = modQuizzes.map(q => {
        const qObj = q.toObject();
        if (isStudent) {
          qObj.questions = (qObj.questions || []).map(item => ({
            _id: item._id,
            question: item.question,
            options: item.options,
            marks: item.marks,
          }));
        }
        return qObj;
      });

      const enrichedVideos = modVideos.map(v => {
        const vObj = v.toObject();
        let u = vObj.cloudinaryUrl || vObj.videoUrl || '';
        u = u.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '');
        vObj.videoUrl = u;
        vObj.cloudinaryUrl = u;
        vObj.completed = completedVideoIds.has(v._id.toString());
        return vObj;
      });

      const enrichedNotes = modNotes.map(n => {
        const nObj = n.toObject();
        let u = nObj.cloudinaryUrl || nObj.fileUrl || nObj.pdfUrl || '';
        u = u.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '');
        nObj.pdfUrl = u;
        nObj.fileUrl = u;
        return nObj;
      });

      const completedInMod = enrichedVideos.filter(v => v.completed).length;
      const planned = m.plannedClasses || 4;

      return {
        moduleId: m._id,
        _id: m._id,
        id: m._id,
        title: m.title,
        description: m.description,
        order: m.order || (idx + 1),
        plannedClasses: planned,
        expectedLectures: planned,
        actualVideosCount: modVideos.length,
        completedVideosCount: completedInMod,
        videos: enrichedVideos,
        notes: enrichedNotes,
        quizzes: safeQuizzes,
      };
    });

    // Check for any unassigned videos/notes/quizzes
    const unassignedVideos = videos.filter(v => !assignedVideoIds.has(v._id.toString()));
    const unassignedNotes = notes.filter(n => !assignedNoteIds.has(n._id.toString()));
    const unassignedQuizzes = quizzes.filter(q => !assignedQuizIds.has(q._id.toString()));

    if (unassignedVideos.length > 0 || unassignedNotes.length > 0 || unassignedQuizzes.length > 0) {
      if (structuredModules.length > 0) {
        // Append to the first module
        const firstMod = structuredModules[0];
        const enrichedExtraVideos = unassignedVideos.map(v => {
          const vObj = v.toObject();
          let u = vObj.cloudinaryUrl || vObj.videoUrl || '';
          u = u.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '');
          vObj.videoUrl = u;
          vObj.cloudinaryUrl = u;
          vObj.completed = completedVideoIds.has(v._id.toString());
          return vObj;
        });
        const enrichedExtraNotes = unassignedNotes.map(n => {
          const nObj = n.toObject();
          let u = nObj.cloudinaryUrl || nObj.fileUrl || nObj.pdfUrl || '';
          u = u.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '');
          nObj.pdfUrl = u;
          nObj.fileUrl = u;
          return nObj;
        });
        const safeExtraQuizzes = unassignedQuizzes.map(q => {
          const qObj = q.toObject();
          if (isStudent) {
            qObj.questions = (qObj.questions || []).map(item => ({
              _id: item._id,
              question: item.question,
              options: item.options,
              marks: item.marks,
            }));
          }
          return qObj;
        });

        firstMod.videos = [...firstMod.videos, ...enrichedExtraVideos];
        firstMod.notes = [...firstMod.notes, ...enrichedExtraNotes];
        firstMod.quizzes = [...firstMod.quizzes, ...safeExtraQuizzes];
        firstMod.actualVideosCount = firstMod.videos.length;
        firstMod.completedVideosCount = firstMod.videos.filter(v => v.completed).length;
      } else {
        // Create a default general module if none exists
        const enrichedExtraVideos = unassignedVideos.map(v => {
          const vObj = v.toObject();
          let u = vObj.cloudinaryUrl || vObj.videoUrl || '';
          u = u.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '');
          vObj.videoUrl = u;
          vObj.cloudinaryUrl = u;
          vObj.completed = completedVideoIds.has(v._id.toString());
          return vObj;
        });
        const enrichedExtraNotes = unassignedNotes.map(n => {
          const nObj = n.toObject();
          let u = nObj.cloudinaryUrl || nObj.fileUrl || nObj.pdfUrl || '';
          u = u.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '');
          nObj.pdfUrl = u;
          nObj.fileUrl = u;
          return nObj;
        });
        const safeExtraQuizzes = unassignedQuizzes.map(q => {
          const qObj = q.toObject();
          if (isStudent) {
            qObj.questions = (qObj.questions || []).map(item => ({
              _id: item._id,
              question: item.question,
              options: item.options,
              marks: item.marks,
            }));
          }
          return qObj;
        });

        structuredModules.push({
          moduleId: 'general_mod_1',
          _id: 'general_mod_1',
          id: 'general_mod_1',
          title: 'Module 1: Course Lectures & Curriculum Notes',
          description: 'Main lecture videos, reading notes and evaluations',
          order: 1,
          plannedClasses: 4,
          expectedLectures: 4,
          actualVideosCount: enrichedExtraVideos.length,
          completedVideosCount: enrichedExtraVideos.filter(v => v.completed).length,
          videos: enrichedExtraVideos,
          notes: enrichedExtraNotes,
          quizzes: safeExtraQuizzes,
        });
      }
    }

    const primaryTeacher = allocations.find(
      a => (a.courseId && a.courseId.toString() === course._id.toString()) ||
           (a.subjectId && sId && a.subjectId.toString() === sId.toString())
    )?.teacherId || null;

    const totalPublishedVideos = videos.length;
    const totalCompletedVideos = progressRecords.length;
    const overallProgress = totalPublishedVideos > 0
      ? Math.min(100, Math.round((totalCompletedVideos / totalPublishedVideos) * 100))
      : 0;

    res.json({
      success: true,
      data: {
        ...course.toObject(),
        course: {
          _id: course._id,
          id: course._id,
          title: course.title,
          courseCode: course.courseCode,
          description: course.description,
          semester: course.semester,
          subject: course.subjectId,
        },
        primaryTeacher,
        totalModules: modules.length,
        totalVideos: totalPublishedVideos,
        totalNotes: notes.length,
        totalQuizzes: quizzes.length,
        totalCompletedVideos,
        overallProgress,
        modules: structuredModules,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Course Detail with All Modules, Videos, Notes & Quizzes
 * GET /api/courses/:id
 */
const getCourseById = async (req, res, next) => {
  return getCourseContent(req, res, next);
};

/**
 * Create Course (Admin only)
 * POST /api/courses
 */
const createCourse = async (req, res, next) => {
  try {
    const { title, courseCode, description, subjectId, semester } = req.body;

    if (!title || !courseCode || !subjectId || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Title, course code, subject reference, and semester are required',
      });
    }

    const course = await Course.create({
      title: title.trim(),
      courseCode: courseCode.toUpperCase().trim(),
      description: description ? description.trim() : '',
      subjectId,
      semester,
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Course (Admin only)
 * PUT /api/courses/:id
 */
const updateCourse = async (req, res, next) => {
  try {
    const { title, courseCode, description, subjectId, semester, status } = req.body;
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (title) course.title = title.trim();
    if (courseCode) courseCode && (course.courseCode = courseCode.toUpperCase().trim());
    if (description !== undefined) course.description = description.trim();
    if (subjectId) course.subjectId = subjectId;
    if (semester) course.semester = semester;
    if (status) course.status = status;

    await course.save();

    res.json({
      success: true,
      message: 'Course updated successfully',
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Course (Admin only)
 * DELETE /api/courses/:id
 */
const deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    await Module.deleteMany({ courseId: course._id });
    await Video.deleteMany({ courseId: course._id });
    await Note.deleteMany({ courseId: course._id });
    await Quiz.deleteMany({ courseId: course._id });
    await Enrollment.deleteMany({ courseId: course._id });
    await course.deleteOne();

    res.json({ success: true, message: 'Course and all child contents deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCourses,
  getCourseById,
  getCourseContent,
  createCourse,
  updateCourse,
  deleteCourse,
};
