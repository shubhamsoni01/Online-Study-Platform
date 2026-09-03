const mongoose = require('mongoose');

const teacherAllocationSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

// Prevent duplicate active allocations of same teacher to same subject
teacherAllocationSchema.index({ teacherId: 1, subjectId: 1 }, { unique: true });

module.exports = mongoose.model('TeacherAllocation', teacherAllocationSchema);
