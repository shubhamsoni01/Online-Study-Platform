const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Sender ID is required'],
    },
    receiverId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Receiver ID is required'],
    },
    senderRole: {
      type: String,
      default: 'user',
    },
    receiverRole: {
      type: String,
      default: 'user',
    },
    senderName: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    isCommon: {
      type: Boolean,
      default: false,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ isCommon: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
