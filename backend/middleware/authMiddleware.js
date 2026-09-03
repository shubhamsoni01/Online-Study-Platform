const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 1. If valid JWT Token is present, authenticate directly from JWT identity
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { userId, role } = decoded;

      let userDoc = null;
      if (role === 'teacher') {
        userDoc = await Teacher.findById(userId).select('-password');
      } else if (role === 'admin' || role === 'super_admin') {
        userDoc = await Admin.findById(userId).select('-password');
      } else if (role === 'student') {
        userDoc = await Student.findById(userId).select('-password');
      }

      // Fallback lookup across User and other models
      if (!userDoc) {
        userDoc = await User.findById(userId).select('-password -studentPassword -teacherPassword -adminPassword');
      }
      if (!userDoc) {
        userDoc = (await Teacher.findById(userId)) || (await Student.findById(userId)) || (await Admin.findById(userId));
      }

      if (userDoc) {
        const userPhoto = userDoc.profilePhoto?.url || userDoc.photo || '';
        req.user = {
          _id: userDoc._id,
          id: userDoc._id.toString(),
          name: userDoc.name || 'User',
          email: userDoc.email || '',
          role: role || (userDoc.roles ? userDoc.roles[0] : 'student'),
          roles: userDoc.roles || [role || 'student'],
          photo: userPhoto,
          profilePhoto: userDoc.profilePhoto || { url: userPhoto },
          department: userDoc.department || '',
          semester: userDoc.semester || '',
          status: userDoc.status || 'Active',
        };
        return next();
      } else {
        req.user = {
          _id: userId,
          id: userId.toString(),
          role: role || 'student',
          roles: [role || 'student'],
          name: 'Authenticated User',
          email: 'user@studyplatform.edu',
          status: 'Active',
          photo: '',
        };
        return next();
      }
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Access denied: Invalid or expired authentication token',
      });
    }
  }

  // No token provided for protected route
  return res.status(401).json({
    success: false,
    message: 'Access denied: Authentication token required',
  });
};

module.exports = { protect };
