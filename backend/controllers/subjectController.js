const Subject = require('../models/Subject');
const TeacherAllocation = require('../models/TeacherAllocation');
const Course = require('../models/Course');
const Module = require('../models/Module');

/**
 * Get All Subjects
 * GET /api/subjects
 */
const getSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find().sort({ semester: 1, name: 1 });

    // Include allocated teachers count & module count
    const allocations = await TeacherAllocation.find({ status: 'Active' }).populate('teacherId', 'name photo');
    const modules = await Module.find({ status: 'Active' });

    const result = subjects.map(s => {
      const assignedTeachers = allocations
        .filter(a => a.subjectId.toString() === s._id.toString())
        .map(a => a.teacherId)
        .filter(Boolean);

      const moduleCount = modules.filter(m => m.subjectId && m.subjectId.toString() === s._id.toString()).length;

      return {
        ...s.toObject(),
        assignedTeachers,
        moduleCount,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Subject
 * GET /api/subjects/:id
 */
const getSubjectById = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const allocations = await TeacherAllocation.find({ subjectId: subject._id, status: 'Active' })
      .populate('teacherId', 'name email department photo');

    res.json({
      success: true,
      data: {
        ...subject.toObject(),
        allocatedTeachers: allocations.map(a => a.teacherId).filter(Boolean),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Subject (Admin only)
 * POST /api/subjects
 */
const createSubject = async (req, res, next) => {
  try {
    const { name, code, semester, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject name is required',
      });
    }

    const trimmedName = name.trim();

    // 1. Case-insensitive and trimmed duplicate check
    const existingByName = await Subject.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (existingByName) {
      return res.status(200).json({
        success: true,
        message: 'Subject already exists in global database',
        data: existingByName,
      });
    }

    // 2. Generate or sanitize subject code
    let cleanCode = code ? code.toUpperCase().trim() : '';
    if (!cleanCode) {
      // Generate acronym or clean alphanumeric prefix
      const words = trimmedName.split(/\s+/);
      const acronym = words.length > 1
        ? words.map(w => w[0]).join('').toUpperCase()
        : trimmedName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
      
      cleanCode = acronym || 'SUB';
      let candidate = cleanCode;
      let suffix = 101;
      while (await Subject.findOne({ code: candidate })) {
        candidate = `${cleanCode}-${suffix++}`;
      }
      cleanCode = candidate;
    }

    const cleanSemester = semester ? semester.trim() : '1st Semester';

    const subject = await Subject.create({
      name: trimmedName,
      code: cleanCode,
      semester: cleanSemester,
      description: description ? description.trim() : `${trimmedName} curriculum subject`,
      status: 'Active',
    });

    // Ensure matching Course offering in database
    let course = await Course.findOne({ subjectId: subject._id });
    if (!course) {
      course = await Course.create({
        title: subject.name,
        courseCode: subject.code,
        subjectId: subject._id,
        semester: subject.semester,
        description: subject.description,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Subject (Admin only)
 * PUT /api/subjects/:id
 */
const updateSubject = async (req, res, next) => {
  try {
    const { name, code, semester, description, status } = req.body;
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    if (name) subject.name = name.trim();
    if (code) subject.code = code.toUpperCase().trim();
    if (semester) subject.semester = semester;
    if (description !== undefined) subject.description = description.trim();
    if (status) subject.status = status;

    await subject.save();

    res.json({
      success: true,
      message: 'Subject updated successfully',
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Subject (Admin only)
 * DELETE /api/subjects/:id
 */
const deleteSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    // Clean up allocations and associated course records
    await TeacherAllocation.deleteMany({ subjectId: subject._id });
    await Course.deleteMany({ subjectId: subject._id });
    await subject.deleteOne();

    res.json({ success: true, message: 'Subject and associated allocations deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
};
