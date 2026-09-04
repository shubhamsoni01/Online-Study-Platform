const Teacher = require('../models/Teacher');
const TeacherAllocation = require('../models/TeacherAllocation');
const Subject = require('../models/Subject');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Video = require('../models/Video');
const Note = require('../models/Note');
const Quiz = require('../models/Quiz');
const Schedule = require('../models/Schedule');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const mongoose = require('mongoose');

/**
 * Shared Helper: Resolve Teacher and Allocated Subjects
 */
const resolveTeacherAndAllocations = async (req, explicitTeacherId = null) => {
  let teacher = null;
  const user = req.user || {};
  const queryOrHeaderId = explicitTeacherId || req.query.teacherId;

  // 1. Try explicit / param / query ID if valid ObjectId
  if (queryOrHeaderId && queryOrHeaderId !== 'me' && mongoose.Types.ObjectId.isValid(queryOrHeaderId)) {
    teacher = await Teacher.findById(queryOrHeaderId).select('-password');
  }

  // 2. Try user._id from JWT
  if (!teacher && user._id && mongoose.Types.ObjectId.isValid(user._id)) {
    teacher = await Teacher.findById(user._id).select('-password');
  }

  // 3. Try user.email from JWT
  if (!teacher && user.email) {
    teacher = await Teacher.findOne({ email: user.email.toLowerCase().trim() }).select('-password');
  }

  if (!teacher) {
    return { teacher: null, allocations: [], enrichedAllocations: [] };
  }

  // Gather all possible ID representations for this teacher
  const teacherIds = [teacher._id];
  if (user._id && mongoose.Types.ObjectId.isValid(user._id) && !teacherIds.some(id => id.toString() === user._id.toString())) {
    teacherIds.push(user._id);
  }

  let allocations = await TeacherAllocation.find({
    teacherId: { $in: teacherIds },
    status: 'Active',
  })
    .populate('teacherId', 'name email department photo profilePhoto')
    .populate('subjectId')
    .populate('courseId');

  // Also include any subjects directly assigned in Subject model
  try {
    const directSubjects = await Subject.find({
      $or: [
        { teacherId: { $in: teacherIds } },
        { assignedTeacher: { $in: teacherIds } },
      ],
      status: { $ne: 'Inactive' },
    });
    for (const ds of directSubjects) {
      if (!allocations.some(a => (a.subjectId?._id || a.subjectId)?.toString() === ds._id.toString())) {
        const course = await Course.findOne({ subjectId: ds._id });
        allocations.push({
          _id: ds._id,
          teacherId: teacher._id,
          subjectId: ds,
          courseId: course || null,
          status: 'Active',
        });
      }
    }
  } catch (e) {}

  const subjectIds = allocations.map(a => a.subjectId?._id || a.subjectId).filter(Boolean);
  const courseIds = allocations.map(a => a.courseId?._id || a.courseId).filter(Boolean);

  const [allModules, allVideos, allNotes, allQuizzes] = await Promise.all([
    Module.find({
      $or: [
        { subjectId: { $in: subjectIds } },
        { courseId: { $in: courseIds } },
      ],
      status: { $ne: 'Archived' },
    }),
    Video.find({
      $or: [
        { subjectId: { $in: subjectIds } },
        { courseId: { $in: courseIds } },
      ],
    }),
    Note.find({
      $or: [
        { subjectId: { $in: subjectIds } },
        { courseId: { $in: courseIds } },
      ],
    }),
    Quiz.find({
      $or: [
        { subjectId: { $in: subjectIds } },
        { courseId: { $in: courseIds } },
      ],
    }),
  ]);

  const enrichedAllocations = allocations.map(a => {
    const sId = a.subjectId?._id?.toString() || a.subjectId?.toString();
    const cId = a.courseId?._id?.toString() || a.courseId?.toString();

    const itemModules = allModules.filter(m => 
      (sId && m.subjectId && m.subjectId.toString() === sId) ||
      (cId && m.courseId && m.courseId.toString() === cId)
    );
    const modIds = itemModules.map(m => m._id.toString());

    const itemVideos = allVideos.filter(v =>
      (sId && v.subjectId && v.subjectId.toString() === sId) ||
      (cId && v.courseId && v.courseId.toString() === cId) ||
      (v.moduleId && modIds.includes(v.moduleId.toString()))
    );
    const itemNotes = allNotes.filter(n =>
      (sId && n.subjectId && n.subjectId.toString() === sId) ||
      (cId && n.courseId && n.courseId.toString() === cId) ||
      (n.moduleId && modIds.includes(n.moduleId.toString()))
    );
    const itemQuizzes = allQuizzes.filter(q =>
      (sId && q.subjectId && q.subjectId.toString() === sId) ||
      (cId && q.courseId && q.courseId.toString() === cId) ||
      (q.moduleId && modIds.includes(q.moduleId.toString()))
    );

    const plannedClasses = itemModules.reduce((acc, m) => acc + (m.plannedClasses || 4), 0);
    const aObj = typeof a.toObject === 'function' ? a.toObject() : { ...a };
    const sObj = (a.subjectId && typeof a.subjectId.toObject === 'function')
      ? a.subjectId.toObject()
      : (a.subjectId && typeof a.subjectId === 'object' ? a.subjectId : null);
    const cObj = (a.courseId && typeof a.courseId.toObject === 'function')
      ? a.courseId.toObject()
      : (a.courseId && typeof a.courseId === 'object' ? a.courseId : null);

    return {
      ...aObj,
      _id: aObj._id || a._id,
      stats: {
        modulesCount: itemModules.length,
        videosCount: itemVideos.length,
        notesCount: itemNotes.length,
        quizzesCount: itemQuizzes.length,
        plannedClasses,
      },
      subjectId: sObj ? {
        ...sObj,
        _id: sObj._id || sObj.id,
        id: sObj._id || sObj.id,
        name: sObj.name,
        code: sObj.code,
        semester: sObj.semester,
        department: sObj.department,
        description: sObj.description,
        modulesCount: itemModules.length,
        videosCount: itemVideos.length,
        notesCount: itemNotes.length,
        quizzesCount: itemQuizzes.length,
        plannedClasses,
      } : null,
      courseId: cObj,
    };
  });

  return { teacher, allocations, enrichedAllocations };
};

/**
 * Get All Teachers (Admin view)
 * GET /api/teachers
 */
const getTeachers = async (req, res, next) => {
  try {
    const teachers = await Teacher.find().select('-password').sort({ createdAt: -1 });

    const allocations = await TeacherAllocation.find({ status: 'Active' })
      .populate('subjectId', 'name code')
      .populate('courseId', 'title courseCode');

    const result = teachers.map(t => {
      const teacherAllocs = allocations.filter(a => a.teacherId.toString() === t._id.toString());
      return {
        ...t.toObject(),
        allocatedSubjects: teacherAllocs.map(a => a.subjectId).filter(Boolean),
        allocatedCourses: teacherAllocs.map(a => a.courseId).filter(Boolean),
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Teacher by ID
 * GET /api/teachers/:id
 */
const getTeacherById = async (req, res, next) => {
  try {
    const { teacher, enrichedAllocations } = await resolveTeacherAndAllocations(req, req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    res.json({
      success: true,
      data: {
        ...(typeof teacher.toObject === 'function' ? teacher.toObject() : teacher),
        allocations: enrichedAllocations,
        allocatedSubjects: enrichedAllocations.map(a => a.subjectId).filter(Boolean),
        allocatedCourses: enrichedAllocations.map(a => a.courseId).filter(Boolean),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current Logged-in Teacher Profile
 * GET /api/teachers/me
 */
const getTeacherProfileMe = async (req, res, next) => {
  try {
    const { teacher, enrichedAllocations } = await resolveTeacherAndAllocations(req);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Authenticated teacher profile not found' });
    }

    const photoUrl = teacher.profilePhoto?.url || teacher.photo || '';
    const allocatedSubjects = enrichedAllocations.map(a => a.subjectId).filter(Boolean);
    const allocatedCourses = enrichedAllocations.map(a => a.courseId).filter(Boolean);

    res.json({
      success: true,
      data: {
        ...(typeof teacher.toObject === 'function' ? teacher.toObject() : teacher),
        _id: teacher._id,
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
        status: teacher.status || 'Active',
        role: teacher.role || 'teacher',
        photo: photoUrl,
        profilePhoto: teacher.profilePhoto || { url: photoUrl },
        allocations: enrichedAllocations,
        allocatedSubjects,
        allocatedCourses,
      },
    });
  } catch (error) {
    console.error('[getTeacherProfileMe Error]', error);
    next(error);
  }
};

/**
 * Get Allocations for a specific Teacher or Current Teacher
 * GET /api/teachers/:teacherId/allocations
 * GET /api/teachers/me/allocations
 */
const getTeacherAllocations = async (req, res, next) => {
  try {
    const targetId = req.params.teacherId === 'me' ? null : req.params.teacherId;
    const { teacher, enrichedAllocations } = await resolveTeacherAndAllocations(req, targetId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    res.json({
      success: true,
      data: enrichedAllocations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get My Assigned Subjects (Strictly for authenticated teacher)
 * GET /api/teachers/my-subjects
 */
const getMyAssignedSubjects = async (req, res, next) => {
  try {
    const { teacher, enrichedAllocations } = await resolveTeacherAndAllocations(req);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    res.json({
      success: true,
      data: enrichedAllocations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Teacher Dashboard Stats
 * GET /api/teachers/dashboard/my-stats
 */
const getTeacherDashboardStats = async (req, res, next) => {
  try {
    const { teacher, enrichedAllocations } = await resolveTeacherAndAllocations(req);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    let totalModules = 0;
    let totalVideos = 0;
    let totalNotes = 0;
    let totalQuizzes = 0;
    let totalPlanned = 0;

    enrichedAllocations.forEach(a => {
      if (a.stats) {
        totalModules += a.stats.modulesCount || 0;
        totalVideos += a.stats.videosCount || 0;
        totalNotes += a.stats.notesCount || 0;
        totalQuizzes += a.stats.quizzesCount || 0;
        totalPlanned += a.stats.plannedClasses || 0;
      }
    });

    res.json({
      success: true,
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          department: teacher.department,
        },
        stats: {
          assignedSubjects: enrichedAllocations.length,
          totalModules,
          totalVideos,
          totalNotes,
          totalQuizzes,
          totalPlannedClasses: totalPlanned,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Teacher Account (Admin only)
 * POST /api/teachers
 */
const createTeacher = async (req, res, next) => {
  try {
    const { name, email, password, department, photo, subjectId, subjectIds } = req.body;

    if (!name || !email || !password || !department) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and department are required fields',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    let photoUrl = photo || '';
    let profilePhotoObj = { url: '', publicId: '' };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'photos', 'image', req.file.originalname);
      photoUrl = uploadResult.secureUrl;
      profilePhotoObj = {
        url: uploadResult.secureUrl,
        publicId: uploadResult.publicId || '',
      };
    }

    const { assignTeacherRole } = require('../utils/multiRoleSync');
    const { user, teacher } = await assignTeacherRole({
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      department: department.trim(),
      photo: photoUrl,
      profilePhoto: profilePhotoObj,
      subjectIds: subjectIds || (subjectId ? [subjectId] : []),
    });

    res.status(201).json({
      success: true,
      message: 'Teacher account assigned successfully',
      data: {
        _id: teacher._id,
        userId: user._id,
        name: teacher.name,
        email: teacher.email,
        roles: user.roles,
        department: teacher.department,
        status: teacher.status,
        photo: teacher.photo,
        profilePhoto: teacher.profilePhoto,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Teacher Account (Admin or Self)
 * PUT /api/teachers/:id
 */
const updateTeacher = async (req, res, next) => {
  try {
    const { name, email, password, department, photo, status } = req.body;
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    if (name) teacher.name = name.trim();
    if (email) teacher.email = email.toLowerCase().trim();
    if (department) teacher.department = department.trim();
    if (photo !== undefined && photo) {
      teacher.photo = photo;
      teacher.profilePhoto = {
        url: photo,
        publicId: req.body.publicId || '',
      };
    }
    if (status) teacher.status = status;
    if (password && password.trim() && password.trim().length >= 6) {
      teacher.password = password.trim();
    }

    if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file.buffer, 'photos', 'image', req.file.originalname);
      teacher.photo = uploadRes.secureUrl;
      teacher.profilePhoto = {
        url: uploadRes.secureUrl,
        publicId: uploadRes.publicId,
      };
    }

    await teacher.save();

    // Sync Unified User model
    const User = require('../models/User');
    const user = await User.findOne({ email: teacher.email.toLowerCase().trim() });
    if (user) {
      if (name) user.name = teacher.name;
      if (department) user.department = teacher.department;
      if (teacher.photo) {
        user.photo = teacher.photo;
        user.profilePhoto = teacher.profilePhoto;
      }
      if (status) user.status = teacher.status;
      if (password && password.trim() && password.trim().length >= 6) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        user.teacherPassword = await bcrypt.hash(password.trim(), salt);
      }
      await user.save();
    }

    res.json({
      success: true,
      message: 'Teacher profile updated successfully',
      data: {
        _id: teacher._id,
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
        status: teacher.status,
        photo: teacher.photo,
        profilePhoto: teacher.profilePhoto,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Teacher Active/Inactive Status (Admin only)
 * PATCH /api/teachers/:id/status
 */
const toggleTeacherStatus = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    teacher.status = teacher.status === 'Active' ? 'Inactive' : 'Active';
    await teacher.save();

    // Sync Unified User
    const User = require('../models/User');
    const user = await User.findOne({ email: teacher.email.toLowerCase().trim() });
    if (user) {
      user.status = teacher.status;
      await user.save();
    }

    res.json({
      success: true,
      message: `Teacher status set to ${teacher.status}`,
      data: {
        _id: teacher._id,
        name: teacher.name,
        status: teacher.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Permanent Delete Teacher Account (Admin only)
 * DELETE /api/teachers/:id
 */
const deleteTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const email = teacher.email.toLowerCase().trim();

    // Remove allocations
    await TeacherAllocation.deleteMany({ teacherId: teacher._id });

    // Sync multi-role removal
    const User = require('../models/User');
    const user = await User.findOne({ email });
    if (user) {
      user.roles = user.roles.filter(r => r !== 'teacher');
      user.teacherPassword = null;
      if (user.roles.length === 0) {
        await user.deleteOne();
      } else {
        await user.save();
      }
    }

    await teacher.deleteOne();

    res.json({
      success: true,
      message: `Teacher ${teacher.name} permanently deleted`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Current Authenticated Teacher Profile & Photo
 * PUT /api/teachers/me
 */
const updateTeacherProfileMe = async (req, res, next) => {
  try {
    const { teacher } = await resolveTeacherAndAllocations(req);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const { name, phone, department, photo, password } = req.body;

    if (name && name.trim()) teacher.name = name.trim();
    if (phone !== undefined) teacher.phone = phone.trim();
    if (department && department.trim()) teacher.department = department.trim();

    // Handle file upload via Multer / Cloudinary
    if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file.buffer, 'teachers', 'image', req.file.originalname);
      teacher.photo = uploadRes.secureUrl;
      teacher.profilePhoto = {
        url: uploadRes.secureUrl,
        publicId: uploadRes.publicId,
      };
    } else if (photo !== undefined && photo) {
      teacher.photo = photo;
      teacher.profilePhoto = {
        url: photo,
        publicId: req.body.publicId || '',
      };
    }

    if (password && password.trim() && password.trim().length >= 6) {
      teacher.password = password.trim();
    }

    await teacher.save();

    // Sync Unified User
    const User = require('../models/User');
    const user = await User.findOne({ email: teacher.email.toLowerCase().trim() });
    if (user) {
      if (name) user.name = teacher.name;
      if (phone !== undefined) user.phone = teacher.phone;
      if (department) user.department = teacher.department;
      if (teacher.photo) {
        user.photo = teacher.photo;
        user.profilePhoto = teacher.profilePhoto;
      }
      if (password && password.trim() && password.trim().length >= 6) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        user.teacherPassword = await bcrypt.hash(password.trim(), salt);
      }
      await user.save();
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: teacher._id,
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        department: teacher.department,
        photo: teacher.photo,
        profilePhoto: teacher.profilePhoto,
        role: 'teacher',
        status: teacher.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Teacher Profile Photo
 * POST /api/teachers/me/photo
 */
const uploadTeacherPhoto = async (req, res, next) => {
  return updateTeacherProfileMe(req, res, next);
};

module.exports = {
  getTeachers,
  getTeacherById,
  getTeacherProfileMe,
  updateTeacherProfileMe,
  uploadTeacherPhoto,
  getTeacherAllocations,
  getMyAssignedSubjects,
  getTeacherDashboardStats,
  createTeacher,
  updateTeacher,
  toggleTeacherStatus,
  deleteTeacher,
};
