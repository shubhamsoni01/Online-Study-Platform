const Note = require('../models/Note');
const Module = require('../models/Module');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');

/**
 * Get Notes by ID
 * GET /api/notes/:id
 */
const getNoteById = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('teacherId', 'name photo department')
      .populate('moduleId', 'title')
      .populate('courseId', 'title courseCode');

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    res.json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

/**
 * Create/Upload PDF Notes
 * POST /api/notes
 */
const createNote = async (req, res, next) => {
  try {
    const { courseId, moduleId, title, description, fileUrl, fileName, fileSize, status } = req.body;

    if (!moduleId || !title) {
      return res.status(400).json({ success: false, message: 'Module ID and title are required' });
    }

    const moduleItem = await Module.findById(moduleId);
    if (!moduleItem) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    let teacherId = null;
    if (req.user && req.user.role === 'teacher') {
      teacherId = req.user._id;
    } else if (req.body.teacherId) {
      teacherId = req.body.teacherId;
    } else if (moduleItem.teacherId) {
      teacherId = moduleItem.teacherId;
    } else if (req.user && req.user._id) {
      teacherId = req.user._id;
    }

    // Authorization: Verify TeacherAllocation for assigned teacher
    if (req.user && req.user.role === 'teacher') {
      const TeacherAllocation = require('../models/TeacherAllocation');
      const Course = require('../models/Course');

      const orConditions = [];
      if (moduleItem.subjectId) orConditions.push({ subjectId: moduleItem.subjectId });
      if (moduleItem.courseId) orConditions.push({ courseId: moduleItem.courseId });

      if (moduleItem.courseId) {
        const c = await Course.findById(moduleItem.courseId);
        if (c && c.subjectId) orConditions.push({ subjectId: c.subjectId });
      }

      const allocation = await TeacherAllocation.findOne({
        teacherId: req.user._id,
        $or: orConditions.length > 0 ? orConditions : [{ subjectId: null }],
        status: 'Active',
      });

      if (!allocation) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not assigned to this subject/course',
        });
      }
    }

    let finalUrl = fileUrl || req.body.url;
    let finalPublicId = req.body.publicId || '';
    let finalGridfsId = '';
    let finalStorageProvider = 'external';
    let finalFileName = fileName || (req.file ? req.file.originalname : `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    let finalFileSize = fileSize || (req.file ? `${(req.file.size / (1024 * 1024)).toFixed(2)} MB` : '');
    let originalName = req.file?.originalname || finalFileName;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'notes', 'raw', req.file.originalname);
      finalUrl = uploadResult.secureUrl;
      finalPublicId = uploadResult.publicId;
      finalGridfsId = uploadResult.gridfsId || '';
      finalStorageProvider = uploadResult.storageProvider || 'gridfs';
      if (uploadResult.fileSize) finalFileSize = uploadResult.fileSize;
    }

    if (!finalUrl) {
      return res.status(400).json({ success: false, message: 'PDF file missing or URL required' });
    }

    const uploadedBy = (req.user && req.user.name) ? req.user.name : (req.body.uploadedBy || 'Faculty');
    const uploadedByEmail = (req.user && req.user.email) ? req.user.email : (req.body.uploadedByEmail || '');

    const note = await Note.create({
      courseId: courseId || moduleItem.courseId || null,
      subjectId: req.body.subjectId || moduleItem.subjectId || null,
      moduleId,
      teacherId,
      title: title.trim(),
      description: description ? description.trim() : '',
      fileUrl: finalUrl,
      pdfUrl: finalUrl,
      cloudinaryUrl: finalUrl,
      fileName: finalFileName,
      originalName,
      fileSize: finalFileSize,
      fileType: 'pdf',
      mimeType: 'application/pdf',
      publicId: finalPublicId,
      gridfsId: finalGridfsId,
      storageProvider: finalStorageProvider,
      uploadedBy,
      uploadedByEmail,
      uploadedAt: new Date(),
      status: status || 'Published',
    });

    res.status(201).json({
      success: true,
      message: 'PDF notes published successfully',
      data: note,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Notes
 * PUT /api/notes/:id
 */
const updateNote = async (req, res, next) => {
  try {
    const { title, description, status } = req.body;
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    if (req.user.role === 'teacher' && note.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own notes' });
    }

    if (title) note.title = title.trim();
    if (description !== undefined) note.description = description.trim();
    if (status) note.status = status;

    await note.save();

    res.json({ success: true, message: 'Notes updated successfully', data: note });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Notes
 * DELETE /api/notes/:id
 */
const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    if (req.user.role === 'teacher' && note.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own notes' });
    }

    if (note.publicId) {
      await deleteFromCloudinary(note.publicId, 'raw');
    }

    await note.deleteOne();
    res.json({ success: true, message: 'Notes deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
};
