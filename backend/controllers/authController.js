const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { getOrCreateUnifiedUser } = require('../utils/multiRoleSync');

const generateToken = (userId, role, roles = []) => {
  return jwt.sign({ userId, role, roles }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

/**
 * Universal or Role-Specific Login
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Fetch unified user & role-specific documents
    const [unifiedUser, adminDoc, teacherDoc, studentDoc] = await Promise.all([
      User.findOne({ email: cleanEmail }).select('+password +studentPassword +teacherPassword +adminPassword'),
      Admin.findOne({ email: cleanEmail }).select('+password'),
      Teacher.findOne({ email: cleanEmail }).select('+password'),
      Student.findOne({ email: cleanEmail }).select('+password'),
    ]);

    // Aggregate all active roles for this email
    const allRoles = new Set();
    if (unifiedUser && Array.isArray(unifiedUser.roles)) {
      unifiedUser.roles.forEach(r => allRoles.add(r));
    }
    if (adminDoc && adminDoc.status !== 'Inactive') allRoles.add(adminDoc.role === 'super_admin' ? 'super_admin' : 'admin');
    if (teacherDoc && teacherDoc.status !== 'Inactive') allRoles.add('teacher');
    if (studentDoc && studentDoc.status !== 'Inactive') allRoles.add('student');

    if (allRoles.size === 0 && !unifiedUser && !adminDoc && !teacherDoc && !studentDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials: User not found',
      });
    }

    let targetRole = role ? role.toLowerCase() : null;
    let authenticatedUser = null;
    let finalRole = null;
    let finalDocId = null;

    // SCENARIO A: Role explicitly requested (student | teacher | admin)
    if (targetRole === 'student') {
      if (!allRoles.has('student')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have a Student role on this account.',
        });
      }

      if (studentDoc && studentDoc.status === 'Inactive') {
        return res.status(403).json({
          success: false,
          message: 'Your student account has been deactivated. Please contact administration.',
        });
      }

      // Check student password
      let matched = false;
      if (studentDoc && studentDoc.password) {
        matched = await studentDoc.matchPassword(password);
      }
      if (!matched && unifiedUser?.studentPassword) {
        matched = await bcrypt.compare(password, unifiedUser.studentPassword);
      }
      if (!matched && unifiedUser?.password) {
        matched = await bcrypt.compare(password, unifiedUser.password);
      }

      if (!matched) {
        return res.status(401).json({ success: false, message: 'Invalid Student credentials: Password incorrect' });
      }

      finalRole = 'student';
      finalDocId = studentDoc ? studentDoc._id : unifiedUser._id;
      authenticatedUser = studentDoc || unifiedUser;
    }
    else if (targetRole === 'teacher') {
      if (!allRoles.has('teacher')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have a Teacher role on this account.',
        });
      }

      if (teacherDoc && teacherDoc.status === 'Inactive') {
        return res.status(403).json({
          success: false,
          message: 'Your teacher account has been deactivated. Please contact administration.',
        });
      }

      // Check teacher password
      let matched = false;
      if (teacherDoc && teacherDoc.password) {
        matched = await teacherDoc.matchPassword(password);
      }
      if (!matched && unifiedUser?.teacherPassword) {
        matched = await bcrypt.compare(password, unifiedUser.teacherPassword);
      }
      if (!matched && unifiedUser?.password) {
        matched = await bcrypt.compare(password, unifiedUser.password);
      }

      if (!matched) {
        return res.status(401).json({ success: false, message: 'Invalid Teacher credentials: Password incorrect' });
      }

      finalRole = 'teacher';
      finalDocId = teacherDoc ? teacherDoc._id : unifiedUser._id;
      authenticatedUser = teacherDoc || unifiedUser;
    }
    else if (targetRole === 'admin' || targetRole === 'super_admin') {
      if (!allRoles.has('admin') && !allRoles.has('super_admin')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have Administrator privileges.',
        });
      }

      if (adminDoc && adminDoc.status === 'Inactive') {
        return res.status(403).json({
          success: false,
          message: 'Your administrator account has been deactivated. Please contact administration.',
        });
      }

      // Check admin password
      let matched = false;
      if (adminDoc && adminDoc.password) {
        matched = await adminDoc.matchPassword(password);
      }
      if (!matched && unifiedUser?.adminPassword) {
        matched = await bcrypt.compare(password, unifiedUser.adminPassword);
      }
      if (!matched && unifiedUser?.password) {
        matched = await bcrypt.compare(password, unifiedUser.password);
      }

      if (!matched) {
        return res.status(401).json({ success: false, message: 'Invalid Administrator credentials: Password incorrect' });
      }

      finalRole = (adminDoc && adminDoc.role === 'super_admin') || allRoles.has('super_admin') ? 'super_admin' : 'admin';
      finalDocId = adminDoc ? adminDoc._id : unifiedUser._id;
      authenticatedUser = adminDoc || unifiedUser;
    }
    // SCENARIO B: Auto-detect credentials across roles
    else {
      // 1. Try Admin
      if (allRoles.has('admin') || allRoles.has('super_admin')) {
        let isMatch = false;
        if (adminDoc && adminDoc.password) isMatch = await adminDoc.matchPassword(password);
        if (!isMatch && unifiedUser?.adminPassword) isMatch = await bcrypt.compare(password, unifiedUser.adminPassword);
        if (isMatch) {
          finalRole = allRoles.has('super_admin') ? 'super_admin' : 'admin';
          finalDocId = adminDoc ? adminDoc._id : unifiedUser._id;
          authenticatedUser = adminDoc || unifiedUser;
        }
      }

      // 2. Try Teacher
      if (!authenticatedUser && allRoles.has('teacher')) {
        let isMatch = false;
        if (teacherDoc && teacherDoc.password) isMatch = await teacherDoc.matchPassword(password);
        if (!isMatch && unifiedUser?.teacherPassword) isMatch = await bcrypt.compare(password, unifiedUser.teacherPassword);
        if (isMatch) {
          finalRole = 'teacher';
          finalDocId = teacherDoc ? teacherDoc._id : unifiedUser._id;
          authenticatedUser = teacherDoc || unifiedUser;
        }
      }

      // 3. Try Student
      if (!authenticatedUser && allRoles.has('student')) {
        let isMatch = false;
        if (studentDoc && studentDoc.password) isMatch = await studentDoc.matchPassword(password);
        if (!isMatch && unifiedUser?.studentPassword) isMatch = await bcrypt.compare(password, unifiedUser.studentPassword);
        if (isMatch) {
          finalRole = 'student';
          finalDocId = studentDoc ? studentDoc._id : unifiedUser._id;
          authenticatedUser = studentDoc || unifiedUser;
        }
      }

      // 4. Fallback: match general password
      if (!authenticatedUser && unifiedUser && unifiedUser.password) {
        const isMatch = await bcrypt.compare(password, unifiedUser.password);
        if (isMatch) {
          finalRole = unifiedUser.roles[0] || 'student';
          finalDocId = unifiedUser._id;
          authenticatedUser = unifiedUser;
        }
      }

      if (!authenticatedUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials: Password incorrect',
        });
      }
    }

    const rolesArray = Array.from(allRoles);
    const token = generateToken(finalDocId, finalRole, rolesArray);

    const userPayload = {
      id: finalDocId,
      _id: finalDocId,
      userId: unifiedUser ? unifiedUser._id : finalDocId,
      name: (finalRole === 'teacher' ? teacherDoc?.name : finalRole === 'student' ? studentDoc?.name : null) || authenticatedUser.name,
      email: cleanEmail,
      role: finalRole,
      roles: rolesArray,
      photo: (finalRole === 'teacher' ? (teacherDoc?.profilePhoto?.url || teacherDoc?.photo) : finalRole === 'student' ? (studentDoc?.profilePhoto?.url || studentDoc?.photo) : null) || authenticatedUser.profilePhoto?.url || authenticatedUser.photo || unifiedUser?.photo || '',
      profilePhoto: (finalRole === 'teacher' ? (teacherDoc?.profilePhoto) : finalRole === 'student' ? (studentDoc?.profilePhoto) : null) || authenticatedUser.profilePhoto || { url: authenticatedUser.photo || '' },
      department: (finalRole === 'teacher' ? teacherDoc?.department : finalRole === 'student' ? studentDoc?.department : null) || authenticatedUser.department || '',
      semester: (finalRole === 'student' ? studentDoc?.semester : null) || authenticatedUser.semester || unifiedUser?.semester || '',
      status: authenticatedUser.status || 'Active',
    };

    res.json({
      success: true,
      token,
      user: userPayload,
      message: `${finalRole.toUpperCase()} login successful`,
      data: {
        token,
        user: userPayload,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Student Self-Registration
 * POST /api/auth/student/register
 * POST /api/auth/register
 */
const registerStudent = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, phone, department, semester } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const targetDepartment = (department || 'Computer Science').trim();
    const targetSemester = (semester || req.body.regSemester || 'Semester 1').trim();
    const targetPhone = phone ? phone.trim() : '';

    // Check if unified user or student already exists
    let user = await User.findOne({ email: cleanEmail });
    let student = await Student.findOne({ email: cleanEmail });

    if (student) {
      return res.status(400).json({
        success: false,
        message: 'A student account with this email address already exists. Please login.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);

    if (user) {
      // Existing user (e.g. Teacher or Admin) adding Student role
      if (!user.roles.includes('student')) {
        user.roles.push('student');
      }
      user.studentPassword = hashedPassword;
      if (!user.password) user.password = hashedPassword;
      user.semester = targetSemester;
      user.department = targetDepartment;
      if (targetPhone) user.phone = targetPhone;
      await user.save();
    } else {
      user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        roles: ['student'],
        studentPassword: hashedPassword,
        password: hashedPassword,
        phone: targetPhone,
        department: targetDepartment,
        semester: targetSemester,
        status: 'Active',
      });
    }

    student = await Student.create({
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      phone: targetPhone,
      department: targetDepartment,
      semester: targetSemester,
      role: 'student',
      status: 'Active',
    });

    const token = generateToken(student._id, 'student', user.roles);

    const userPayload = {
      id: student._id,
      _id: student._id,
      userId: user._id,
      name: student.name,
      email: student.email,
      role: 'student',
      roles: user.roles,
      phone: student.phone,
      department: student.department,
      semester: student.semester,
      photo: student.photo || '',
      profilePhoto: student.profilePhoto || { url: student.photo || '' },
      status: student.status,
    };

    res.status(201).json({
      success: true,
      message: 'Student account registered successfully',
      token,
      user: userPayload,
      data: {
        token,
        user: userPayload,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Student-Specific Login
 * POST /api/auth/student/login
 */
const studentLogin = async (req, res, next) => {
  req.body.role = 'student';
  return login(req, res, next);
};

/**
 * Teacher-Specific Login
 * POST /api/auth/teacher/login
 */
const teacherLogin = async (req, res, next) => {
  req.body.role = 'teacher';
  return login(req, res, next);
};

/**
 * Get Authenticated User Details
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const userObj = typeof req.user.toObject === 'function' ? req.user.toObject() : req.user;
    res.json({
      success: true,
      user: userObj,
      data: {
        ...userObj,
        user: userObj,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  registerStudent,
  studentLogin,
  teacherLogin,
  getMe,
};
