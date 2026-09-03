const TeacherAllocation = require('../models/TeacherAllocation');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const Course = require('../models/Course');

/**
 * Get All Allocations
 * GET /api/allocations
 */
const getAllocations = async (req, res, next) => {
  try {
    const allocations = await TeacherAllocation.find({ status: 'Active' })
      .populate('teacherId', 'name email department photo')
      .populate('subjectId', 'name code semester')
      .populate('courseId', 'title courseCode');

    res.json({ success: true, data: allocations });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Allocations for a specific Teacher
 * GET /api/allocations/teacher/:teacherId
 */
const getTeacherAllocations = async (req, res, next) => {
  try {
    const allocations = await TeacherAllocation.find({
      teacherId: req.params.teacherId,
      status: 'Active',
    }).populate('subjectId').populate('courseId');

    res.json({ success: true, data: allocations });
  } catch (error) {
    next(error);
  }
};

/**
 * Set/Sync Allocations for a Teacher (Admin specifies multiple subjects)
 * POST /api/allocations/sync
 * Body: { teacherId, subjectIds: [id1, id2, ...] }
 */
const syncTeacherAllocations = async (req, res, next) => {
  try {
    const { teacherId, subjectIds } = req.body;

    if (!teacherId || !Array.isArray(subjectIds)) {
      return res.status(400).json({
        success: false,
        message: 'teacherId and subjectIds array are required',
      });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    // Deactivate/delete previous allocations for this teacher
    await TeacherAllocation.deleteMany({ teacherId });

    // Create new active allocations
    const Course = require('../models/Course');
    const Subject = require('../models/Subject');
    const mongoose = require('mongoose');

    const newAllocations = [];
    for (const item of subjectIds) {
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

      const created = await TeacherAllocation.create({
        teacherId,
        subjectId: sub._id,
        courseId: course ? course._id : null,
        status: 'Active',
      });

      console.log(`Teacher allocation created:\nteacherId = ${teacherId}\nsubjectId = ${sub._id}\ncourseId = ${course ? course._id : 'none'}`);
      newAllocations.push(created);
    }

    res.json({
      success: true,
      message: `Successfully updated ${newAllocations.length} subject allocation(s) for ${teacher.name}`,
      data: newAllocations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Single Allocation
 * POST /api/allocations
 */
const createAllocation = async (req, res, next) => {
  try {
    const { teacherId, subjectId, courseId } = req.body;

    if (!teacherId || !subjectId) {
      return res.status(400).json({
        success: false,
        message: 'Teacher and Subject references are required',
      });
    }

    const allocation = await TeacherAllocation.findOneAndUpdate(
      { teacherId, subjectId },
      { teacherId, subjectId, courseId: courseId || null, status: 'Active' },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Teacher allocation saved successfully',
      data: allocation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove Allocation
 * DELETE /api/allocations/:id
 */
const deleteAllocation = async (req, res, next) => {
  try {
    const alloc = await TeacherAllocation.findById(req.params.id);
    if (!alloc) {
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }

    await alloc.deleteOne();
    res.json({ success: true, message: 'Allocation deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllocations,
  getTeacherAllocations,
  syncTeacherAllocations,
  createAllocation,
  deleteAllocation,
};
