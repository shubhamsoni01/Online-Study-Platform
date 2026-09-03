const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Course = require('../models/Course');
const TeacherAllocation = require('../models/TeacherAllocation');

/**
 * Get or create unified User document by email
 */
async function getOrCreateUnifiedUser(email, defaultData = {}) {
  const cleanEmail = email.toLowerCase().trim();
  let user = await User.findOne({ email: cleanEmail }).select('+password +studentPassword +teacherPassword +adminPassword');

  if (!user) {
    // Check if legacy Admin, Teacher, or Student exists
    const [adminDoc, teacherDoc, studentDoc] = await Promise.all([
      Admin.findOne({ email: cleanEmail }).select('+password'),
      Teacher.findOne({ email: cleanEmail }).select('+password'),
      Student.findOne({ email: cleanEmail }).select('+password'),
    ]);

    const initialRoles = [];
    if (adminDoc) initialRoles.push(adminDoc.role === 'super_admin' ? 'super_admin' : 'admin');
    if (teacherDoc) initialRoles.push('teacher');
    if (studentDoc) initialRoles.push('student');

    if (initialRoles.length === 0) {
      initialRoles.push(defaultData.role || 'student');
    }

    const name = defaultData.name || adminDoc?.name || teacherDoc?.name || studentDoc?.name || 'User';
    const department = defaultData.department || teacherDoc?.department || studentDoc?.department || 'Computer Science';
    const photo = defaultData.photo || adminDoc?.photo || teacherDoc?.photo || studentDoc?.photo || '';

    user = new User({
      name,
      email: cleanEmail,
      roles: Array.from(new Set(initialRoles)),
      department,
      photo,
      status: 'Active',
    });

    if (studentDoc && studentDoc.password) user.studentPassword = studentDoc.password;
    if (teacherDoc && teacherDoc.password) user.teacherPassword = teacherDoc.password;
    if (adminDoc && adminDoc.password) user.adminPassword = adminDoc.password;

    if (defaultData.password) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(defaultData.password, salt);
      if (defaultData.role === 'teacher') user.teacherPassword = hashed;
      else if (defaultData.role === 'admin') user.adminPassword = hashed;
      else user.studentPassword = hashed;
      user.password = hashed;
    }

    await user.save();
  }

  return user;
}

/**
 * Assign or update Teacher role for an email
 */
async function assignTeacherRole({ name, email, password, department, photo, profilePhoto, subjectIds }) {
  const cleanEmail = email.toLowerCase().trim();
  const user = await getOrCreateUnifiedUser(cleanEmail, { name, department, photo, role: 'teacher' });

  if (name) user.name = name.trim();
  if (department) user.department = department.trim();
  if (photo) user.photo = photo;
  if (profilePhoto) user.profilePhoto = profilePhoto;

  if (!user.roles.includes('teacher')) {
    user.roles.push('teacher');
  }

  let teacherHash = user.teacherPassword;
  if (password) {
    const salt = await bcrypt.genSalt(10);
    teacherHash = await bcrypt.hash(password, salt);
    user.teacherPassword = teacherHash;
    if (!user.password) user.password = teacherHash;
  }

  await user.save();

  // Synchronize with Teacher collection for isolated teacher routes
  let teacher = await Teacher.findOne({ email: cleanEmail }).select('+password');
  if (!teacher) {
    teacher = new Teacher({
      name: user.name,
      email: cleanEmail,
      department: user.department || 'Computer Science',
      photo: user.photo || '',
      profilePhoto: user.profilePhoto || { url: user.photo || '', publicId: '' },
      status: 'Active',
      role: 'teacher',
    });
  } else {
    teacher.name = user.name;
    teacher.department = user.department;
    if (user.photo) teacher.photo = user.photo;
    if (user.profilePhoto) teacher.profilePhoto = user.profilePhoto;
    teacher.status = 'Active';
  }

  if (teacherHash) {
    teacher.password = teacherHash;
  } else if (!teacher.password && password) {
    teacher.password = password;
  }
  await teacher.save();

  // Process and allocate subjects
  if (subjectIds) {
    let rawSubjects = [];
    if (Array.isArray(subjectIds)) {
      rawSubjects = subjectIds;
    } else if (typeof subjectIds === 'string') {
      try {
        const parsed = JSON.parse(subjectIds);
        rawSubjects = Array.isArray(parsed) ? parsed : [subjectIds];
      } catch {
        rawSubjects = subjectIds.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const mongoose = require('mongoose');
    for (const item of rawSubjects) {
      const str = String(item).trim();
      if (!str) continue;

      let sub = null;
      if (mongoose.Types.ObjectId.isValid(str)) {
        sub = await Subject.findById(str);
      }
      if (!sub) {
        sub = await Subject.findOne({
          name: { $regex: new RegExp(`^${str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        });
      }
      if (!sub) {
        const words = str.split(/\s+/);
        const acronym = words.length > 1
          ? words.map(w => w[0]).join('').toUpperCase()
          : str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
        let cleanCode = acronym || 'SUB';
        let candidate = cleanCode;
        let suffix = 101;
        while (await Subject.findOne({ code: candidate })) {
          candidate = `${cleanCode}-${suffix++}`;
        }
        sub = await Subject.create({
          name: str,
          code: candidate,
          semester: '1st Semester',
          description: `${str} curriculum subject`,
          status: 'Active',
        });
      }

      let course = await Course.findOne({ subjectId: sub._id });
      if (!course) {
        course = await Course.create({
          title: sub.name,
          courseCode: sub.code,
          subjectId: sub._id,
          semester: sub.semester || '1st Semester',
          description: sub.description,
        });
      }

      const existingAlloc = await TeacherAllocation.findOne({
        teacherId: teacher._id,
        subjectId: sub._id,
      });

      if (!existingAlloc) {
        await TeacherAllocation.create({
          teacherId: teacher._id,
          subjectId: sub._id,
          courseId: course ? course._id : null,
          status: 'Active',
        });
      }
    }
  }

  return { user, teacher };
}

/**
 * Assign or update Admin role for an email
 */
async function assignAdminRole({ name, email, password }) {
  const cleanEmail = email.toLowerCase().trim();
  const user = await getOrCreateUnifiedUser(cleanEmail, { name, role: 'admin' });

  if (name) user.name = name.trim();
  if (!user.roles.includes('admin') && !user.roles.includes('super_admin')) {
    user.roles.push('admin');
  }

  let adminHash = user.adminPassword;
  if (password) {
    const salt = await bcrypt.genSalt(10);
    adminHash = await bcrypt.hash(password, salt);
    user.adminPassword = adminHash;
    if (!user.password) user.password = adminHash;
  }

  await user.save();

  // Synchronize with Admin collection
  let admin = await Admin.findOne({ email: cleanEmail }).select('+password');
  if (!admin) {
    admin = new Admin({
      name: user.name,
      email: cleanEmail,
      role: 'admin',
      status: 'Active',
    });
  } else {
    admin.name = user.name;
    admin.status = 'Active';
  }

  if (adminHash) {
    admin.password = adminHash;
  } else if (!admin.password && password) {
    admin.password = password;
  }
  await admin.save();

  return { user, admin };
}

/**
 * Remove Teacher role from an email
 */
async function removeTeacherRole(email) {
  const cleanEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: cleanEmail });
  if (user) {
    user.roles = user.roles.filter(r => r !== 'teacher');
    await user.save();
  }

  const teacher = await Teacher.findOne({ email: cleanEmail });
  if (teacher) {
    teacher.status = 'Inactive';
    await teacher.save();
  }

  return { success: true, user };
}

/**
 * Remove Admin role from an email (safeguarded against last admin)
 */
async function removeAdminRole(email) {
  const cleanEmail = email.toLowerCase().trim();

  // Safeguard: Check remaining active Admins
  const totalAdmins = await Admin.countDocuments({ status: 'Active' });
  if (totalAdmins <= 1) {
    const isThisLastAdmin = await Admin.findOne({ email: cleanEmail, status: 'Active' });
    if (isThisLastAdmin) {
      throw new Error('You cannot remove the last Administrator.');
    }
  }

  const user = await User.findOne({ email: cleanEmail });
  if (user) {
    if (user.roles.includes('super_admin') || cleanEmail === 'kumarshubham3187@gmail.com') {
      throw new Error('Super Administrator accounts cannot be stripped of administrator rights.');
    }
    user.roles = user.roles.filter(r => r !== 'admin' && r !== 'super_admin');
    await user.save();
  }

  const admin = await Admin.findOne({ email: cleanEmail });
  if (admin) {
    if (admin.role === 'super_admin' || cleanEmail === 'kumarshubham3187@gmail.com') {
      throw new Error('Super Administrator accounts cannot be deleted.');
    }
    await admin.deleteOne();
  }

  return { success: true, user };
}

module.exports = {
  getOrCreateUnifiedUser,
  assignTeacherRole,
  assignAdminRole,
  removeTeacherRole,
  removeAdminRole,
};
