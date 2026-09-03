const Video = require('../models/Video');
const Module = require('../models/Module');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');

/**
 * Get Video by ID with comments count
 * GET /api/videos/:id
 */
const getVideoById = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('teacherId', 'name photo department')
      .populate('moduleId', 'title')
      .populate('courseId', 'title courseCode');

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    res.json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
};

/**
 * Create/Upload Video
 * POST /api/videos
 * Accepts multipart/form-data with file or JSON with cloudinaryUrl
 */
const createVideo = async (req, res, next) => {
  try {
    const {
      courseId,
      moduleId,
      title,
      description,
      cloudinaryUrl,
      videoUrl,
      duration,
      cloudinaryPublicId,
      publicId,
      fileSize,
      resourceType,
      status,
    } = req.body;

    if (!moduleId || !title) {
      return res.status(400).json({ success: false, message: 'Module ID and video title are required' });
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

    let finalUrl = cloudinaryUrl || videoUrl || req.body.url;
    let finalPublicId = cloudinaryPublicId || publicId || '';
    let finalDuration = duration || '15:00';
    let finalFileSize = fileSize || '';
    let finalResourceType = resourceType || 'video';

    // If file was uploaded via Multer
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'videos', 'video', req.file.originalname);
      finalUrl = uploadResult.secureUrl;
      finalPublicId = uploadResult.publicId;
      if (uploadResult.duration) finalDuration = uploadResult.duration;
      if (uploadResult.fileSize) finalFileSize = uploadResult.fileSize;
      if (uploadResult.resourceType) finalResourceType = uploadResult.resourceType;
    }

    if (!finalUrl) {
      return res.status(400).json({ success: false, message: 'File missing or video URL required' });
    }

    const uploadedBy = (req.user && req.user.name) ? req.user.name : (req.body.uploadedBy || 'Faculty');
    const uploadedByEmail = (req.user && req.user.email) ? req.user.email : (req.body.uploadedByEmail || '');

    const video = await Video.create({
      courseId: courseId || moduleItem.courseId || null,
      subjectId: req.body.subjectId || moduleItem.subjectId || null,
      moduleId,
      teacherId,
      title: title.trim(),
      description: description ? description.trim() : '',
      cloudinaryUrl: finalUrl,
      videoUrl: finalUrl,
      publicId: finalPublicId,
      cloudinaryPublicId: finalPublicId,
      duration: finalDuration,
      fileSize: finalFileSize,
      resourceType: finalResourceType,
      uploadedBy,
      uploadedByEmail,
      uploadedAt: new Date(),
      status: status || 'Published',
    });

    res.status(201).json({
      success: true,
      message: 'Lecture video uploaded and published successfully',
      data: video,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Video
 * PUT /api/videos/:id
 */
const updateVideo = async (req, res, next) => {
  try {
    const { title, description, status, duration } = req.body;
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    if (req.user.role === 'teacher' && video.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own videos' });
    }

    if (title) video.title = title.trim();
    if (description !== undefined) video.description = description.trim();
    if (status) video.status = status;
    if (duration) video.duration = duration;

    await video.save();

    res.json({ success: true, message: 'Video updated successfully', data: video });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Video
 * DELETE /api/videos/:id
 */
const deleteVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    if (req.user.role === 'teacher' && video.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own videos' });
    }

    if (video.publicId) {
      await deleteFromCloudinary(video.publicId, 'video');
    }

    // Also remove comments associated with this video
    const Comment = require('../models/Comment');
    await Comment.deleteMany({ videoId: video._id });
    await video.deleteOne();

    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
};
