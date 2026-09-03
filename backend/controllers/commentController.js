const Comment = require('../models/Comment');
const Video = require('../models/Video');
const Subject = require('../models/Subject');
const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const TeacherAllocation = require('../models/TeacherAllocation');
const mongoose = require('mongoose');

/**
 * Helper: Resolve Teacher and Allocated Subjects for Comment Moderation
 */
const resolveTeacherSubjectIds = async (req) => {
  const user = req.user || {};
  let teacher = null;

  if (user._id && mongoose.Types.ObjectId.isValid(user._id)) {
    teacher = await Teacher.findById(user._id);
  }
  if (!teacher && user.email) {
    teacher = await Teacher.findOne({ email: user.email.toLowerCase().trim() });
  }

  if (!teacher) {
    return { teacher: null, subjectIds: [], courseIds: [] };
  }

  const teacherIds = [teacher._id];
  if (user._id && !teacherIds.some(id => id.toString() === user._id.toString())) {
    teacherIds.push(user._id);
  }

  const allocations = await TeacherAllocation.find({
    teacherId: { $in: teacherIds },
    status: 'Active',
  });

  const subjectIds = allocations.map(a => a.subjectId).filter(Boolean);
  const courseIds = allocations.map(a => a.courseId).filter(Boolean);

  // Direct subject assignments
  const directSubjects = await Subject.find({
    $or: [{ teacherId: { $in: teacherIds } }, { assignedTeacher: { $in: teacherIds } }],
    status: { $ne: 'Inactive' },
  });
  directSubjects.forEach(ds => {
    if (!subjectIds.some(s => s.toString() === ds._id.toString())) {
      subjectIds.push(ds._id);
    }
  });

  return { teacher, subjectIds, courseIds, teacherIds };
};

/**
 * Get Comments for a Video (with threaded replies)
 * GET /api/comments/video/:videoId
 */
const getVideoComments = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const comments = await Comment.find({ videoId, status: 'Active' })
      .sort({ createdAt: 1 });

    // Nest top-level comments and replies
    const topLevel = [];
    const repliesMap = {};

    comments.forEach(c => {
      if (c.parentCommentId) {
        const parentId = c.parentCommentId.toString();
        if (!repliesMap[parentId]) repliesMap[parentId] = [];
        repliesMap[parentId].push(c);
      } else {
        topLevel.push(c.toObject());
      }
    });

    const structured = topLevel.map(c => ({
      ...c,
      replies: repliesMap[c._id.toString()] || [],
      isReplied: (repliesMap[c._id.toString()] || []).length > 0,
    }));

    res.json({ success: true, data: structured, count: comments.length });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Student Comments for Authenticated Teacher's Assigned Subjects
 * GET /api/comments/teacher/my-comments
 */
const getTeacherComments = async (req, res, next) => {
  try {
    const { teacher, subjectIds, courseIds, teacherIds } = await resolveTeacherSubjectIds(req);
    if (!teacher) {
      return res.status(403).json({ success: false, message: 'Teacher identity not found' });
    }

    // Find all videos allocated to this teacher
    const teacherVideos = await Video.find({
      $or: [
        { teacherId: { $in: teacherIds } },
        { subjectId: { $in: subjectIds } },
        { courseId: { $in: courseIds } },
      ],
    }).select('_id title subjectId courseId teacherId');

    const videoIds = teacherVideos.map(v => v._id);

    // Filter params
    const { search, subjectId, filter } = req.query;

    let query = {
      videoId: { $in: videoIds },
      parentCommentId: null,
      status: 'Active',
    };

    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      query.subjectId = subjectId;
    }

    const comments = await Comment.find(query).sort({ createdAt: -1 });
    const commentIds = comments.map(c => c._id);

    // Fetch replies for these comments
    const replies = await Comment.find({
      parentCommentId: { $in: commentIds },
      status: 'Active',
    }).sort({ createdAt: 1 });

    const repliesMap = {};
    replies.forEach(r => {
      const pid = r.parentCommentId.toString();
      if (!repliesMap[pid]) repliesMap[pid] = [];
      repliesMap[pid].push(r.toObject());
    });

    let results = comments.map(c => {
      const cObj = c.toObject();
      const commentReplies = repliesMap[c._id.toString()] || [];
      return {
        ...cObj,
        commentId: c._id,
        studentId: c.userId,
        studentName: c.userName,
        studentEmail: c.userEmail,
        commentText: c.text,
        replies: commentReplies,
        isReplied: commentReplies.length > 0,
      };
    });

    // Apply text search filter if present
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter(
        r =>
          (r.studentName && r.studentName.toLowerCase().includes(q)) ||
          (r.videoTitle && r.videoTitle.toLowerCase().includes(q)) ||
          (r.subjectName && r.subjectName.toLowerCase().includes(q)) ||
          (r.text && r.text.toLowerCase().includes(q))
      );
    }

    // Apply Replied / Unreplied filter
    if (filter === 'unreplied') {
      results = results.filter(r => !r.isReplied);
    } else if (filter === 'replied') {
      results = results.filter(r => r.isReplied);
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      unrepliedCount: results.filter(r => !r.isReplied).length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add Comment or Reply on a Video
 * POST /api/comments
 * Body: { videoId, text, parentCommentId }
 */
const addComment = async (req, res, next) => {
  try {
    const rawText = req.body.text || req.body.commentText || req.body.comment || '';
    const { videoId, parentCommentId } = req.body;
    const user = req.user;

    if (!videoId || !rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, message: 'Video ID and comment text are required' });
    }

    const video = await Video.findById(videoId).populate('subjectId courseId teacherId');
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const videoTitle = video.title || '';
    const subjectId = video.subjectId?._id || video.subjectId || null;
    let subjectName = video.subjectId?.name || '';
    if (!subjectName && subjectId) {
      const sDoc = await Subject.findById(subjectId);
      if (sDoc) subjectName = sDoc.name;
    }

    const courseId = video.courseId?._id || video.courseId || null;
    const teacherId = video.teacherId?._id || video.teacherId || null;
    let teacherEmail = video.teacherId?.email || '';
    if (!teacherEmail && teacherId) {
      const tDoc = await Teacher.findById(teacherId);
      if (tDoc) teacherEmail = tDoc.email;
    }

    const comment = await Comment.create({
      videoId,
      videoTitle,
      subjectId,
      subjectName,
      courseId,
      teacherId,
      teacherEmail,
      userId: user._id || user.id,
      userName: user.name || 'User',
      userEmail: user.email || '',
      userRole: user.role || 'student',
      text: rawText.trim(),
      parentCommentId: parentCommentId || null,
      status: 'Active',
    });

    res.status(201).json({
      success: true,
      message: parentCommentId ? 'Reply posted successfully' : 'Comment posted successfully',
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reply directly to a Comment
 * POST /api/comments/:id/reply
 */
const addReply = async (req, res, next) => {
  try {
    const parentComment = await Comment.findById(req.params.id);
    if (!parentComment) {
      return res.status(404).json({ success: false, message: 'Parent comment not found' });
    }

    const rawText = req.body.text || req.body.replyText || req.body.commentText || '';
    const user = req.user;

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, message: 'Reply text cannot be empty' });
    }

    const reply = await Comment.create({
      videoId: parentComment.videoId,
      videoTitle: parentComment.videoTitle,
      subjectId: parentComment.subjectId,
      subjectName: parentComment.subjectName,
      courseId: parentComment.courseId,
      teacherId: parentComment.teacherId,
      teacherEmail: parentComment.teacherEmail,
      userId: user._id || user.id,
      userName: user.name || (user.role === 'teacher' ? 'Instructor' : 'User'),
      userEmail: user.email || '',
      userRole: user.role || 'teacher',
      text: rawText.trim(),
      parentCommentId: parentComment._id,
      status: 'Active',
    });

    res.status(201).json({
      success: true,
      message: 'Reply posted successfully',
      data: reply,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Comment (Author or Assigned Teacher / Admin moderation)
 * DELETE /api/comments/:id
 */
const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const user = req.user;
    const userIdStr = (user._id || user.id || '').toString();
    const isAuthor = comment.userId && comment.userId.toString() === userIdStr;
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';

    let isAuthorizedTeacher = false;
    if (user.role === 'teacher') {
      const { subjectIds, teacherIds } = await resolveTeacherSubjectIds(req);
      if (
        (comment.teacherId && teacherIds.some(id => id.toString() === comment.teacherId.toString())) ||
        (comment.subjectId && subjectIds.some(s => s.toString() === comment.subjectId.toString()))
      ) {
        isAuthorizedTeacher = true;
      }
    }

    if (!isAuthor && !isAdmin && !isAuthorizedTeacher) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this comment' });
    }

    // Also delete any child replies
    await Comment.deleteMany({ parentCommentId: comment._id });
    await comment.deleteOne();

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVideoComments,
  getTeacherComments,
  addComment,
  addReply,
  deleteComment,
};
