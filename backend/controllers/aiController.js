const { generateQuizWithGroq, askDoubtWithGroq } = require('../services/groqService');
const Module = require('../models/Module');
const Course = require('../models/Course');
const Video = require('../models/Video');
const Teacher = require('../models/Teacher');
const Note = require('../models/Note');

/**
 * Generate MCQs with Groq AI (Teacher only)
 * POST /api/ai/generate-quiz
 */
const generateQuiz = async (req, res, next) => {
  try {
    const { topic, numQuestions, difficulty, contextText, moduleId, courseId } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required to generate quiz questions',
      });
    }

    let courseTitle = '';
    let moduleTitle = '';

    if (moduleId) {
      const m = await Module.findById(moduleId);
      if (m) moduleTitle = m.title;
    }

    if (courseId) {
      const c = await Course.findById(courseId);
      if (c) courseTitle = c.title;
    }

    const questions = await generateQuizWithGroq({
      topic: topic.trim(),
      numQuestions: parseInt(numQuestions) || 3,
      difficulty: difficulty || 'Medium',
      contextText: contextText || '',
      courseTitle,
      moduleTitle,
    });

    res.json({
      success: true,
      message: 'AI questions generated successfully for teacher review',
      data: {
        topic: topic.trim(),
        difficulty: difficulty || 'Medium',
        count: questions.length,
        questions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Dynamic AI Doubt Assistant for Video Lectures
 * POST /api/ai/ask-doubt
 * Body: { question, videoId, courseId, moduleId, conversationHistory }
 */
const askDoubt = async (req, res, next) => {
  try {
    const rawQuestion = req.body.question || req.body.doubtText || req.body.doubt || req.body.message || req.body.prompt || '';
    const { videoId, courseId, moduleId, conversationHistory } = req.body;

    if (!rawQuestion || !rawQuestion.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Question content cannot be empty.',
      });
    }

    const question = rawQuestion.trim();

    let videoTitle = '';
    let courseTitle = '';
    let moduleTitle = '';
    let teacherName = '';
    let notesContext = '';

    // Fetch video metadata
    if (videoId) {
      try {
        const vid = await Video.findById(videoId);
        if (vid) {
          videoTitle = vid.title || '';
          if (vid.description) notesContext += ` Video Overview: ${vid.description}.`;
          if (vid.teacherId) {
            const t = await Teacher.findById(vid.teacherId);
            if (t) teacherName = t.name;
          }
        }
      } catch (e) {}
    }

    // Fetch module metadata & notes
    if (moduleId) {
      try {
        const mod = await Module.findById(moduleId);
        if (mod) {
          moduleTitle = mod.title || '';
          if (mod.description) notesContext += ` Module Description: ${mod.description}.`;
        }
        const notes = await Note.find({ moduleId, status: 'Active' }).limit(3);
        if (notes.length > 0) {
          notesContext += ` Attached Notes & Handouts: ${notes.map(n => n.title + (n.description ? ` (${n.description})` : '')).join('; ')}.`;
        }
      } catch (e) {}
    }

    // Fetch course metadata
    if (courseId) {
      try {
        const course = await Course.findById(courseId);
        if (course) {
          courseTitle = course.title || '';
          if (!teacherName && course.teacherId) {
            const t = await Teacher.findById(course.teacherId);
            if (t) teacherName = t.name;
          }
        }
      } catch (e) {}
    }

    const aiAnswer = await askDoubtWithGroq({
      question: question.trim(),
      videoTitle,
      courseTitle,
      moduleTitle,
      teacherName,
      notesContext,
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
    });

    res.json({
      success: true,
      data: {
        answer: aiAnswer,
        videoContext: {
          videoId: videoId || null,
          videoTitle,
          courseTitle,
          moduleTitle,
          teacherName,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateQuiz,
  askDoubt,
};
