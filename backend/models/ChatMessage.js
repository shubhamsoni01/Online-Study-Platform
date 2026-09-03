const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    room: {
      type: String,
      enum: ['common', 'staff'],
      required: [true, 'Chat room is required (common or staff)'],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Sender ID is required'],
      index: true,
    },
    senderName: {
      type: String,
      required: [true, 'Sender name is required'],
      trim: true,
    },
    senderRole: {
      type: String,
      enum: ['student', 'teacher', 'admin', 'super_admin'],
      required: [true, 'Sender role is required'],
    },
    senderPhoto: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      userId: mongoose.Schema.Types.Mixed,
      role: String,
      name: String,
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ room: 1, deleted: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
