const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'Video reference is required'],
    },
    videoTitle: {
      type: String,
      default: '',
      trim: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    subjectName: {
      type: String,
      default: '',
      trim: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
    },
    teacherEmail: {
      type: String,
      default: '',
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'User ID is required'],
    },
    userName: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    userEmail: {
      type: String,
      default: '',
      trim: true,
    },
    userRole: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      required: [true, 'User role is required'],
    },
    text: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases for clean API consumption
commentSchema.virtual('commentId').get(function () {
  return this._id;
});
commentSchema.virtual('studentId').get(function () {
  return this.userId;
});
commentSchema.virtual('studentName').get(function () {
  return this.userName;
});
commentSchema.virtual('studentEmail').get(function () {
  return this.userEmail;
});
commentSchema.virtual('commentText').get(function () {
  return this.text;
});

module.exports = mongoose.model('Comment', commentSchema);
