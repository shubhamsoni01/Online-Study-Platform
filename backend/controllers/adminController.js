const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

/**
 * Get Platform Dashboard Statistics
 * GET /api/admins/stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const [totalTeachers, totalStudents, totalSubjects, totalCourses, totalEnrollments] = await Promise.all([
      Teacher.countDocuments(),
      Student.countDocuments(),
      Subject.countDocuments(),
      Course.countDocuments(),
      Enrollment.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        totalTeachers,
        totalStudents,
        totalSubjects,
        totalCourses,
        totalEnrollments,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Admins
 * GET /api/admins
 */
const getAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: admins });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Admin
 * POST /api/admins
 */
const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, photo } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const { assignAdminRole } = require('../utils/multiRoleSync');
    const { user, admin } = await assignAdminRole({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Admin account assigned successfully',
      data: {
        _id: admin._id,
        userId: user._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        roles: user.roles,
        status: admin.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Admin
 * PUT /api/admins/:id
 */
const updateAdmin = async (req, res, next) => {
  try {
    const { name, email, photo, status, password } = req.body;
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    if (admin.role === 'super_admin' || admin.email === 'kumarshubham3187@gmail.com') {
      if (req.user && req.user.email !== admin.email && req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Super Administrator accounts can only be modified by the Super Admin.' });
      }
    }

    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase().trim();
    if (photo !== undefined) admin.photo = photo;
    if (status) admin.status = status;
    if (password) admin.password = password;

    await admin.save();

    res.json({
      success: true,
      message: 'Admin updated successfully',
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        status: admin.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Admin
 * DELETE /api/admins/:id
 */
const deleteAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Protect Super Admin from deletion
    if (admin.role === 'super_admin' || admin.email === 'kumarshubham3187@gmail.com' || admin.email === process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Super Administrator accounts cannot be deleted.' });
    }

    await admin.deleteOne();
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Enrollment Analysis (Detailed student records & course summaries)
 * GET /api/admins/enrollment-analysis
 */
const getEnrollmentAnalysis = async (req, res, next) => {
  try {
    const { courseId } = req.query;
    const filter = {};
    if (courseId) filter.courseId = courseId;

    const [courses, enrollments] = await Promise.all([
      Course.find().populate('subjectId', 'name code'),
      Enrollment.find(filter)
        .populate('studentId', 'name email rollNumber department')
        .populate('courseId', 'title courseCode')
        .sort({ enrolledAt: -1 }),
    ]);

    const courseSummary = courses.map(c => {
      const count = enrollments.filter(e => e.courseId && e.courseId._id.toString() === c._id.toString()).length;
      return {
        courseId: c._id,
        courseTitle: c.title,
        courseCode: c.courseCode,
        subjectName: c.subjectId?.name || '',
        enrolledCount: count,
      };
    });

    const detailedList = enrollments.map(e => ({
      _id: e._id,
      studentName: e.studentId?.name || 'Unknown Student',
      studentEmail: e.studentId?.email || 'N/A',
      studentRoll: e.studentId?.rollNumber || '',
      courseTitle: e.courseId?.title || 'Unknown Course',
      courseCode: e.courseId?.courseCode || '',
      enrollmentDate: e.enrolledAt,
      status: e.status,
    }));

    res.json({
      success: true,
      data: {
        courseSummary,
        enrollments: detailedList,
        totalEnrolledCount: detailedList.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Admin Password
 * POST /api/admins/change-password
 * Body: { currentPassword, newPassword, confirmPassword }
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const adminId = req.user._id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation are required',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation password do not match',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const admin = await Admin.findById(adminId).select('+password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const isMatch = await admin.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password',
      });
    }

    // Set new password (pre-save hook will hash it)
    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getEnrollmentAnalysis,
  changePassword,
};

