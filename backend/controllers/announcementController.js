const Announcement = require('../models/Announcement');

/**
 * Get All Announcements (Common Feed)
 * GET /api/announcements
 */
const getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Announcement.find({ published: { $ne: false }, status: 'Active' })
      .populate('teacherId', 'name photo department')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: announcements });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Announcement (Teacher only)
 * POST /api/announcements
 */
const createAnnouncement = async (req, res, next) => {
  try {
    const { title, message, subjectId, courseId, subjectName, date } = req.body;
    const teacherId = (req.user && req.user._id) ? req.user._id : (req.body.teacherId || null);
    const teacherName = (req.user && req.user.name) ? req.user.name : (req.body.teacherName || 'Faculty');

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    if (!teacherId) {
      return res.status(400).json({ success: false, message: 'Teacher identity is required' });
    }

    let finalSubjectName = subjectName || '';
    if (subjectId && !finalSubjectName) {
      const Subject = require('../models/Subject');
      const sub = await Subject.findById(subjectId);
      if (sub) finalSubjectName = sub.name;
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      message: message.trim(),
      teacherId,
      teacherName,
      subjectId: subjectId || null,
      courseId: courseId || null,
      subjectName: finalSubjectName,
      date: date || new Date().toISOString().split('T')[0],
      published: true,
      status: 'Active',
    });

    res.status(201).json({
      success: true,
      message: 'Announcement published successfully',
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Announcement (Teacher author only)
 * PUT /api/announcements/:id
 */
const updateAnnouncement = async (req, res, next) => {
  try {
    const { title, message, subjectName, date, status } = req.body;
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    if (announcement.teacherId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only edit your own announcements' });
    }

    if (title) announcement.title = title.trim();
    if (message) announcement.message = message.trim();
    if (subjectName !== undefined) announcement.subjectName = subjectName;
    if (date) announcement.date = date;
    if (status) announcement.status = status;

    await announcement.save();

    res.json({ success: true, message: 'Announcement updated successfully', data: announcement });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Announcement (Teacher author only)
 * DELETE /api/announcements/:id
 */
const deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    if (announcement.teacherId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only delete your own announcements' });
    }

    await announcement.deleteOne();
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
