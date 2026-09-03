const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
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
      required: [true, 'Notes title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    fileUrl: {
      type: String,
      required: [true, 'PDF file URL is required'],
    },
    pdfUrl: {
      type: String,
      default: '',
    },
    fileName: {
      type: String,
      default: '',
    },
    fileSize: {
      type: String,
      default: '',
    },
    fileType: {
      type: String,
      default: 'pdf',
    },
    publicId: {
      type: String,
      default: '',
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

module.exports = mongoose.model('Note', noteSchema);
