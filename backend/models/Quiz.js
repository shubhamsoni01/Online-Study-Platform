const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, 'Question statement is required'],
      trim: true,
    },
    options: {
      type: [String],
      required: [true, 'Options array is required'],
      validate: [val => val.length >= 2, 'Must have at least 2 options'],
    },
    correctAnswer: {
      type: String,
      required: [true, 'Correct answer is required'],
    },
    marks: {
      type: Number,
      default: 1,
    },
    explanation: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
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
      required: [true, 'Teacher reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    questions: [questionSchema],
    totalMarks: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number, // in minutes
      default: 15,
    },
    status: {
      type: String,
      enum: ['Published', 'Draft'],
      default: 'Published',
    },
  },
  { timestamps: true }
);

quizSchema.pre('save', function (next) {
  if (this.questions && this.questions.length > 0) {
    this.totalMarks = this.questions.reduce((acc, q) => acc + (q.marks || 1), 0);
  }
  next();
});

module.exports = mongoose.model('Quiz', quizSchema);
