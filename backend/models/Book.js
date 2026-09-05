const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    bookName: {
      type: String,
      required: [true, 'Book name is required'],
      trim: true,
    },
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    subjectName: {
      type: String,
      default: 'General',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      enum: ['Data Structures', 'DBMS', 'OS', 'Networking', 'Other'],
      default: 'Other',
    },
    fileUrl: {
      type: String,
      required: [true, 'PDF file URL is required'],
    },
    publicId: {
      type: String,
      default: '',
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
      default: 'application/pdf',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
    },
    status: {
      type: String,
      enum: ['Active', 'Archived'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
