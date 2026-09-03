const Quiz = require('../models/Quiz');
const Module = require('../models/Module');

/**
 * Get Quiz by ID
 * GET /api/quizzes/:id
 */
const getQuizById = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('teacherId', 'name photo')
      .populate('moduleId', 'title')
      .populate('courseId', 'title courseCode');

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // If caller is student, strip correct answers and explanations before attempt submission
    let data = quiz.toObject();
    if (req.user && req.user.role === 'student') {
      data.questions = data.questions.map(q => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        marks: q.marks,
      }));
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Quiz Manually or Save Reviewed AI Quiz (Teacher only)
 * POST /api/quizzes
 */
const createQuiz = async (req, res, next) => {
  try {
    const { courseId, moduleId, title, description, questions, duration, status } = req.body;
    const teacherId = req.user._id;

    if (!moduleId || !title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Module ID, quiz title, and at least one question are required',
      });
    }

    const moduleItem = await Module.findById(moduleId);
    if (!moduleItem) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    // Authorization: Verify TeacherAllocation for assigned teacher
    if (req.user && req.user.role === 'teacher') {
      const TeacherAllocation = require('../models/TeacherAllocation');
      const Course = require('../models/Course');

      const orConditions = [];
      if (moduleItem.subjectId) orConditions.push({ subjectId: moduleItem.subjectId });
      if (moduleItem.courseId) orConditions.push({ courseId: moduleItem.courseId });

      if (moduleItem.courseId) {
        const c = await Course.findById(moduleItem.courseId);
        if (c && c.subjectId) orConditions.push({ subjectId: c.subjectId });
      }

      const allocation = await TeacherAllocation.findOne({
        teacherId: req.user._id,
        $or: orConditions.length > 0 ? orConditions : [{ subjectId: null }],
        status: 'Active',
      });

      if (!allocation) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not assigned to this subject/course',
        });
      }
    }

    // Format questions
    const formattedQuestions = questions.map(q => ({
      question: q.question.trim(),
      options: q.options.map(opt => (typeof opt === 'string' ? opt.trim() : String(opt))),
      correctAnswer: q.correctAnswer,
      marks: q.marks || 1,
      explanation: q.explanation || '',
    }));

    const quiz = await Quiz.create({
      courseId: courseId || moduleItem.courseId || null,
      subjectId: req.body.subjectId || moduleItem.subjectId || null,
      moduleId,
      teacherId,
      title: title.trim(),
      description: description ? description.trim() : '',
      questions: formattedQuestions,
      duration: duration || 15,
      status: status || 'Published',
    });

    res.status(201).json({
      success: true,
      message: 'Quiz created and published successfully',
      data: quiz,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Quiz
 * PUT /api/quizzes/:id
 */
const updateQuiz = async (req, res, next) => {
  try {
    const { title, description, questions, duration, status } = req.body;
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (req.user.role === 'teacher' && quiz.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own quizzes' });
    }

    if (title) quiz.title = title.trim();
    if (description !== undefined) quiz.description = description.trim();
    if (duration) quiz.duration = duration;
    if (status) quiz.status = status;
    if (Array.isArray(questions)) {
      quiz.questions = questions.map(q => ({
        question: q.question.trim(),
        options: q.options.map(opt => (typeof opt === 'string' ? opt.trim() : String(opt))),
        correctAnswer: q.correctAnswer,
        marks: q.marks || 1,
        explanation: q.explanation || '',
      }));
    }

    await quiz.save();

    res.json({ success: true, message: 'Quiz updated successfully', data: quiz });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Quiz
 * DELETE /api/quizzes/:id
 */
const deleteQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (req.user.role === 'teacher' && quiz.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own quizzes' });
    }

    const QuizAttempt = require('../models/QuizAttempt');
    await QuizAttempt.deleteMany({ quizId: quiz._id });
    await quiz.deleteOne();

    res.json({ success: true, message: 'Quiz deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
};
