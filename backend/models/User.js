const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    roles: {
      type: [String],
      enum: ['student', 'teacher', 'admin', 'super_admin'],
      default: ['student'],
    },
    // Role-specific hashed passwords
    studentPassword: {
      type: String,
      select: false,
    },
    teacherPassword: {
      type: String,
      select: false,
    },
    adminPassword: {
      type: String,
      select: false,
    },
    // Default fallback password
    password: {
      type: String,
      select: false,
    },
    photo: {
      type: String,
      default: '',
    },
    profilePhoto: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    department: {
      type: String,
      default: 'Computer Science',
      trim: true,
    },
    semester: {
      type: String,
      default: '1st Semester',
      trim: true,
    },
    rollNumber: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

// Method to verify password against a specific role
userSchema.methods.matchRolePassword = async function (enteredPassword, requestedRole) {
  let targetHash = null;
  if (requestedRole === 'student') {
    targetHash = this.studentPassword || this.password;
  } else if (requestedRole === 'teacher') {
    targetHash = this.teacherPassword || this.password;
  } else if (requestedRole === 'admin' || requestedRole === 'super_admin') {
    targetHash = this.adminPassword || this.password;
  } else {
    targetHash = this.password || this.studentPassword || this.teacherPassword || this.adminPassword;
  }

  if (!targetHash) return false;
  return await bcrypt.compare(enteredPassword, targetHash);
};

// Method to hash and set a specific role password
userSchema.methods.setRolePassword = async function (newPassword, role) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);
  if (role === 'student') {
    this.studentPassword = hash;
  } else if (role === 'teacher') {
    this.teacherPassword = hash;
  } else if (role === 'admin' || role === 'super_admin') {
    this.adminPassword = hash;
  }
  if (!this.password) {
    this.password = hash;
  }
};

module.exports = mongoose.model('User', userSchema);
