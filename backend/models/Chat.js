const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          refPath: 'participantModel',
        },
        participantModel: {
          type: String,
          required: true,
          enum: ['Teacher', 'Student', 'Admin'],
        },
        name: { type: String },
        role: { type: String, enum: ['teacher', 'student', 'admin'] },
      },
    ],
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Archived'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Chat', chatSchema);
