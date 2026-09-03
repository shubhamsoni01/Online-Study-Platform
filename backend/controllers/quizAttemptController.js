const QuizAttempt = require('../models/QuizAttempt');
const Quiz = require('../models/Quiz');

/**
 * Submit Quiz Answers & Evaluate
 * POST /api/quiz-attempts
 * Body: { quizId, answers: [{ questionId, selectedAnswer }] }
 */
const submitQuizAttempt = async (req, res, next) => {
  try {
    const { quizId, answers } = req.body;
    const studentId = req.user._id;

    if (!quizId || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'quizId and answers array are required',
      });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;

    const evaluatedAnswers = quiz.questions.map(q => {
      const qIdStr = q._id.toString();
      const userSubmission = answers.find(a => a.questionId === qIdStr);
      const selectedAnswer = userSubmission ? userSubmission.selectedAnswer : '';
      const isCorrect = selectedAnswer === q.correctAnswer;
      const marksEarned = isCorrect ? (q.marks || 1) : 0;

      totalMarks += (q.marks || 1);
      if (isCorrect) {
        correctCount++;
        score += marksEarned;
      } else {
        wrongCount++;
      }

      return {
        questionId: qIdStr,
        question: q.question,
        options: q.options,
        selectedAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        marksEarned,
        explanation: q.explanation || '',
      };
    });

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

    const attempt = await QuizAttempt.create({
      studentId,
      quizId,
      courseId: quiz.courseId,
      answers: evaluatedAnswers,
      score,
      totalMarks,
      correctCount,
      wrongCount,
      totalQuestions: quiz.questions.length,
      percentage,
      submittedAt: new Date(),
      completedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Quiz evaluated successfully',
      data: {
        _id: attempt._id,
        quizTitle: quiz.title,
        score,
        totalMarks,
        correctCount,
        wrongCount,
        totalQuestions: quiz.questions.length,
        percentage,
        breakdown: evaluatedAnswers,
        submittedAt: attempt.submittedAt,
        completedAt: attempt.completedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Student Attempts for a Quiz or Course
 * GET /api/quiz-attempts/my-attempts?quizId=... or ?courseId=...
 */
const getMyAttempts = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const { quizId, courseId } = req.query;
    const filter = { studentId };

    if (quizId) filter.quizId = quizId;
    if (courseId) filter.courseId = courseId;

    const attempts = await QuizAttempt.find(filter)
      .populate('quizId', 'title')
      .sort({ completedAt: -1 });

    res.json({ success: true, data: attempts });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Specific Attempt Evaluation Report
 * GET /api/quiz-attempts/:id
 */
const getAttemptById = async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findById(req.params.id)
      .populate('quizId', 'title duration')
      .populate('courseId', 'title courseCode')
      .populate('studentId', 'name email rollNumber department');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt record not found' });
    }

    res.json({ success: true, data: attempt });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Teacher Quiz Results for Assigned Courses
 * GET /api/quiz-attempts/teacher/my-results
 */
const getTeacherQuizResults = async (req, res, next) => {
  try {
    const teacherId = req.user._id;
    const TeacherAllocation = require('../models/TeacherAllocation');
    const Course = require('../models/Course');

    let courseFilter = {};

    if (req.user.role === 'teacher') {
      const allocations = await TeacherAllocation.find({ teacherId, status: 'Active' });
      const subjectIds = allocations.map(a => a.subjectId).filter(Boolean);
      const allocatedCourseIds = allocations.map(a => a.courseId).filter(Boolean);

      const matchingCourses = await Course.find({
        $or: [
          { _id: { $in: allocatedCourseIds } },
          { subjectId: { $in: subjectIds } },
        ],
      });

      const allowedCourseIds = matchingCourses.map(c => c._id);
      courseFilter = { courseId: { $in: allowedCourseIds } };
    }

    const attempts = await QuizAttempt.find(courseFilter)
      .populate('studentId', 'name email rollNumber department')
      .populate('quizId', 'title duration')
      .populate('courseId', 'title courseCode')
      .sort({ createdAt: -1 });

    const results = attempts.map(a => ({
      _id: a._id,
      studentName: a.studentId?.name || 'Student',
      studentEmail: a.studentId?.email || 'N/A',
      studentRoll: a.studentId?.rollNumber || '',
      quizTitle: a.quizId?.title || 'Quiz Assessment',
      courseTitle: a.courseId?.title || 'Curriculum Course',
      score: a.score,
      totalMarks: a.totalMarks,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      totalQuestions: a.totalQuestions || (a.correctCount + a.wrongCount),
      percentage: a.percentage,
      attemptDate: a.submittedAt || a.completedAt,
    }));

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitQuizAttempt,
  getMyAttempts,
  getAttemptById,
  getTeacherQuizResults,
};

