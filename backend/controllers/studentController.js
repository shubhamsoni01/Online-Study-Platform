const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');

/**
 * Get All Students (Admin view)
 * GET /api/students
 */
const getStudents = async (req, res, next) => {
  try {
    const students = await Student.find().select('-password').sort({ createdAt: -1 });

    // Populate enrolled courses count
    const enrollments = await Enrollment.find({ status: 'Active' })
      .populate('courseId', 'title courseCode');

    const result = students.map(st => {
      const stEnrollments = enrollments.filter(e => e.studentId.toString() === st._id.toString());
      return {
        ...st.toObject(),
        enrolledCourses: stEnrollments.map(e => e.courseId).filter(Boolean),
        enrolledCount: stEnrollments.length,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Student by ID
 * GET /api/students/:id
 */
const getStudentById = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id).select('-password');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const enrollments = await Enrollment.find({ studentId: student._id, status: 'Active' })
      .populate('courseId');

    res.json({
      success: true,
      data: {
        ...student.toObject(),
        enrollments,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Student (Admin registration)
 * POST /api/students
 */
const createStudent = async (req, res, next) => {
  try {
    const { name, email, password, department, semester, rollNumber, photo } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await Student.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Student with this email already exists' });
    }

    const student = await Student.create({
      name,
      email: cleanEmail,
      password,
      department: department || 'Computer Science',
      semester: semester || '1st Semester',
      rollNumber: rollNumber || '',
      photo: photo || '',
    });

    res.status(201).json({
      success: true,
      message: 'Student account created successfully',
      data: {
        _id: student._id,
        name: student.name,
        email: student.email,
        department: student.department,
        semester: student.semester,
        rollNumber: student.rollNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Student Profile
 * PUT /api/students/:id
 */
const updateStudent = async (req, res, next) => {
  try {
    const { name, email, password, department, semester, rollNumber, photo, status } = req.body;
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (name) student.name = name;
    if (email) student.email = email.toLowerCase().trim();
    if (department) student.department = department;
    if (semester) student.semester = semester;
    if (rollNumber) student.rollNumber = rollNumber;
    if (photo !== undefined) student.photo = photo;
    if (status) student.status = status;
    if (password && password.trim()) student.password = password.trim();

    await student.save();

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: {
        _id: student._id,
        name: student.name,
        email: student.email,
        status: student.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Student (Admin only)
 * DELETE /api/students/:id
 */
const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await Enrollment.deleteMany({ studentId: student._id });
    await student.deleteOne();

    res.json({ success: true, message: 'Student and enrollments deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authenticated Student Profile
 * GET /api/students/me
 */
const getStudentProfileMe = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const student = await Student.findById(studentId).select('-password');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const enrollments = await Enrollment.find({ studentId: student._id, status: 'Active' })
      .populate({
        path: 'courseId',
        populate: { path: 'subjectId', select: 'name code semester' },
      });

    res.json({
      success: true,
      data: {
        ...student.toObject(),
        enrollments,
        enrolledCourses: enrollments.map(e => e.courseId).filter(Boolean),
        enrolledCount: enrollments.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

const { uploadToCloudinary } = require('../services/cloudinaryService');

/**
 * Update Authenticated Student Profile
 * PUT /api/students/me
 */
const updateStudentProfileMe = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    let student = await Student.findById(studentId);
    if (!student && req.user.email) {
      student = await Student.findOne({ email: req.user.email.toLowerCase().trim() });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const { name, phone, department, semester, photo, password } = req.body;

    if (name && name.trim()) student.name = name.trim();
    if (phone !== undefined) student.phone = phone.trim();
    if (department && department.trim()) student.department = department.trim();
    if (semester && semester.trim()) student.semester = semester.trim();

    // Handle file upload via Multer / Cloudinary
    if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file.buffer, 'students', 'image', req.file.originalname);
      student.photo = uploadRes.secureUrl;
      student.profilePhoto = {
        url: uploadRes.secureUrl,
        publicId: uploadRes.publicId,
      };
    } else if (photo !== undefined && photo) {
      student.photo = photo;
      student.profilePhoto = {
        url: photo,
        publicId: req.body.publicId || '',
      };
    }

    if (password && password.trim() && password.trim().length >= 6) {
      student.password = password.trim();
    }

    await student.save();

    // Sync Unified User
    const User = require('../models/User');
    const user = await User.findOne({ email: student.email.toLowerCase().trim() });
    if (user) {
      if (name) user.name = student.name;
      if (phone !== undefined) user.phone = student.phone;
      if (department) user.department = student.department;
      if (semester) user.semester = student.semester;
      if (student.photo) {
        user.photo = student.photo;
        user.profilePhoto = student.profilePhoto;
      }
      if (password && password.trim() && password.trim().length >= 6) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        user.studentPassword = await bcrypt.hash(password.trim(), salt);
      }
      await user.save();
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: student._id,
        id: student._id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        department: student.department,
        semester: student.semester,
        photo: student.photo,
        profilePhoto: student.profilePhoto,
        role: student.role || 'student',
        status: student.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Student Profile Photo
 * POST /api/students/me/photo
 */
const uploadStudentPhoto = async (req, res, next) => {
  return updateStudentProfileMe(req, res, next);
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentProfileMe,
  updateStudentProfileMe,
  uploadStudentPhoto,
};
