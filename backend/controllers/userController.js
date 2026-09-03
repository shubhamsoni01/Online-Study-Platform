const User = require('../models/User');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const TeacherAllocation = require('../models/TeacherAllocation');
const {
  getOrCreateUnifiedUser,
  assignTeacherRole,
  assignAdminRole,
  removeTeacherRole,
  removeAdminRole,
} = require('../utils/multiRoleSync');

/**
 * Get all platform users with combined roles
 * GET /api/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    // 1. Gather all existing emails across Admin, Teacher, Student, and User
    const [admins, teachers, students, users] = await Promise.all([
      Admin.find(),
      Teacher.find(),
      Student.find(),
      User.find(),
    ]);

    const userMap = new Map();

    // Index existing unified users
    users.forEach(u => {
      userMap.set(u.email.toLowerCase().trim(), {
        _id: u._id,
        name: u.name,
        email: u.email,
        roles: Array.isArray(u.roles) ? [...u.roles] : ['student'],
        department: u.department || '',
        semester: u.semester || '',
        phone: u.phone || '',
        photo: u.profilePhoto?.url || u.photo || '',
        status: u.status || 'Active',
        createdAt: u.createdAt,
      });
    });

    // Merge Admins
    admins.forEach(a => {
      const em = a.email.toLowerCase().trim();
      const roleName = a.role === 'super_admin' ? 'super_admin' : 'admin';
      if (!userMap.has(em)) {
        userMap.set(em, {
          _id: a._id,
          name: a.name,
          email: a.email,
          roles: [roleName],
          department: 'Administration',
          photo: a.photo || '',
          status: a.status || 'Active',
          createdAt: a.createdAt,
        });
      } else {
        const item = userMap.get(em);
        if (!item.roles.includes('admin') && !item.roles.includes('super_admin')) {
          item.roles.push(roleName);
        }
      }
    });

    // Merge Teachers
    teachers.forEach(t => {
      const em = t.email.toLowerCase().trim();
      if (!userMap.has(em)) {
        userMap.set(em, {
          _id: t._id,
          name: t.name,
          email: t.email,
          roles: ['teacher'],
          department: t.department || 'Computer Science',
          photo: t.profilePhoto?.url || t.photo || '',
          status: t.status || 'Active',
          createdAt: t.createdAt,
        });
      } else {
        const item = userMap.get(em);
        if (!item.roles.includes('teacher')) {
          item.roles.push('teacher');
        }
        if (t.department && !item.department) item.department = t.department;
      }
    });

    // Merge Students
    students.forEach(s => {
      const em = s.email.toLowerCase().trim();
      if (!userMap.has(em)) {
        userMap.set(em, {
          _id: s._id,
          name: s.name,
          email: s.email,
          roles: ['student'],
          department: s.department || 'Computer Science',
          semester: s.semester || '1st Semester',
          photo: s.profilePhoto?.url || s.photo || '',
          status: s.status || 'Active',
          createdAt: s.createdAt,
        });
      } else {
        const item = userMap.get(em);
        if (!item.roles.includes('student')) {
          item.roles.push('student');
        }
      }
    });

    // Fetch allocations for teachers
    const allocations = await TeacherAllocation.find({ status: 'Active' })
      .populate('teacherId', 'email')
      .populate('subjectId', 'name code');

    const teacherAllocMap = new Map();
    allocations.forEach(a => {
      const tEmail = a.teacherId?.email?.toLowerCase().trim();
      if (tEmail && a.subjectId) {
        if (!teacherAllocMap.has(tEmail)) teacherAllocMap.set(tEmail, []);
        teacherAllocMap.get(tEmail).push({
          subjectId: a.subjectId._id,
          name: a.subjectId.name,
          code: a.subjectId.code,
        });
      }
    });

    const list = Array.from(userMap.values()).map(u => {
      const allocatedSubjects = teacherAllocMap.get(u.email.toLowerCase().trim()) || [];
      return {
        ...u,
        isTeacher: u.roles.includes('teacher'),
        isAdmin: u.roles.includes('admin') || u.roles.includes('super_admin'),
        isStudent: u.roles.includes('student'),
        allocatedSubjects,
      };
    });

    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign or update Teacher role for a user
 * POST /api/users/assign-teacher
 */
const assignTeacher = async (req, res, next) => {
  try {
    const { name, email, password, department, photo, subjectIds } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Teacher password must be at least 6 characters long' });
    }

    let photoUrl = photo || '';
    let profilePhotoObj = { url: '', publicId: '' };

    if (req.file) {
      const { uploadToCloudinary } = require('../services/cloudinaryService');
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'photos', 'image', req.file.originalname);
      photoUrl = uploadResult.secureUrl;
      profilePhotoObj = { url: uploadResult.secureUrl, publicId: uploadResult.publicId || '' };
    }

    const { user, teacher } = await assignTeacherRole({
      name: name || user?.name || 'Teacher',
      email,
      password,
      department: department || 'Computer Science',
      photo: photoUrl,
      profilePhoto: profilePhotoObj,
      subjectIds,
    });

    res.json({
      success: true,
      message: `Teacher role successfully assigned to ${email}`,
      data: {
        userId: user._id,
        teacherId: teacher._id,
        email: user.email,
        roles: user.roles,
        department: teacher.department,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Make user an Admin
 * POST /api/users/make-admin
 */
const makeAdmin = async (req, res, next) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const adminPassword = password || 'Admin@2026';
    const { user, admin } = await assignAdminRole({
      name: name || 'Administrator',
      email,
      password: adminPassword,
    });

    res.json({
      success: true,
      message: `Admin privileges successfully granted to ${email}`,
      data: {
        userId: user._id,
        adminId: admin._id,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove Teacher role from a user
 * POST /api/users/remove-teacher
 */
const removeTeacher = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    await removeTeacherRole(email);
    res.json({
      success: true,
      message: `Teacher role removed from ${email}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove Admin role from a user
 * POST /api/users/remove-admin
 */
const removeAdmin = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    await removeAdminRole(email);
    res.json({
      success: true,
      message: `Admin role removed from ${email}`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  assignTeacher,
  makeAdmin,
  removeTeacher,
  removeAdmin,
};
