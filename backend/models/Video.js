const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: [true, 'Module reference is required'],
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    cloudinaryUrl: {
      type: String,
      required: [true, 'Cloudinary URL is required'],
    },
    videoUrl: {
      type: String,
      default: '',
    },
    publicId: {
      type: String,
      default: '',
    },
    cloudinaryPublicId: {
      type: String,
      default: '',
    },
    duration: {
      type: String,
      default: '00:00',
    },
    gridfsId: {
      type: String,
      default: '',
    },
    storageProvider: {
      type: String,
      enum: ['gridfs', 'cloudinary', 'local', 'external'],
      default: 'gridfs',
    },
    originalName: {
      type: String,
      default: '',
    },
    mimeType: {
      type: String,
      default: 'video/mp4',
    },
    fileSize: {
      type: String,
      default: '',
    },
    resourceType: {
      type: String,
      default: 'video',
    },
    uploadedBy: {
      type: String,
      default: '',
    },
    uploadedByEmail: {
      type: String,
      default: '',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Published', 'Draft'],
      default: 'Published',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Video', videoSchema);
