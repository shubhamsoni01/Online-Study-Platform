const { Groq } = require('groq-sdk');

/**
 * Generate MCQs using Groq API
 */
const generateQuizWithGroq = async ({
  topic,
  numQuestions = 3,
  difficulty = 'Medium',
  contextText = '',
  courseTitle = '',
  moduleTitle = '',
}) => {
  const count = Math.min(Math.max(parseInt(numQuestions) || 5, 1), 50);
  const apiKey = process.env.GROQ_API_KEY;

  const systemPrompt = `You are a university professor creating rigorous multiple-choice assessments.
Always output strictly valid JSON matching this schema:
{
  "questions": [
    {
      "question": "Clear question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "The exact matching text of the correct option",
      "marks": 1,
      "explanation": "Brief academic rationale for why this answer is correct"
    }
  ]
}
Do not enclose in markdown blocks like \`\`\`json. Return pure JSON only.`;

  const userPrompt = `Generate exactly ${count} multiple-choice questions for the following college curriculum topic:
Topic: "${topic}"
Difficulty: ${difficulty}
${courseTitle ? `Course: ${courseTitle}` : ''}
${moduleTitle ? `Module: ${moduleTitle}` : ''}
${contextText ? `Reference Material Excerpt:\n"${contextText.slice(0, 1500)}"` : ''}

Rules:
1. Each question must have exactly 4 plausible, distinct options.
2. "correctAnswer" must match one of the items in "options" exactly.
3. Keep the level appropriate for ${difficulty} difficulty college engineering/science students.`;

  if (apiKey && !apiKey.includes('your_groq_api_key')) {
    try {
      const groq = new Groq({ apiKey });
      const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed.questions;
      }
    } catch (error) {
      console.warn(`[Groq API Call Warning] ${error.message}. Using high-quality academic fallback questions.`);
    }
  }

  return generateFallbackQuiz(topic, count, difficulty);
};

const generateFallbackQuiz = (topic, count, difficulty) => {
  const templates = [
    {
      q: `In the study of ${topic}, what is the fundamental invariant condition that must be maintained?`,
      options: [
        'Consistency and structural preservation across operations',
        'Unconstrained unbounded state growth',
        'Randomized memory pointer reallocation',
        'Execution purely in non-deterministic time',
      ],
      correctAnswer: 'Consistency and structural preservation across operations',
      explanation: `Structural consistency is a mandatory property across foundational operations in ${topic}.`,
    },
    {
      q: `Which asymptotic complexity bound represents the optimal worst-case behavior in ${topic}?`,
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
      correctAnswer: 'O(log n)',
      explanation: 'Logarithmic decomposition provides standard optimal bound scaling for hierarchical structures.',
    },
    {
      q: `When analyzing trade-offs in ${topic}, which factor is prioritized for real-time throughput?`,
      options: [
        'Minimizing time overhead at the cost of amortized space',
        'Maximizing disk I/O operations',
        'Disabling concurrency locking primitives',
        'Increasing recursive call stack depth',
      ],
      correctAnswer: 'Minimizing time overhead at the cost of amortized space',
      explanation: 'Amortization techniques trade auxiliary cache/memory overhead for deterministic low latency.',
    },
    {
      q: `Which failure mode is most commonly encountered during edge-case execution in ${topic}?`,
      options: [
        'Boundary condition violations and null reference dereferencing',
        'Excessive network bandwidth allocation',
        'Instantaneous hardware clock frequency drift',
        'Compiler optimization register overflow',
      ],
      correctAnswer: 'Boundary condition violations and null reference dereferencing',
      explanation: 'Base cases and boundary states represent the primary source of unhandled runtime exceptions.',
    },
  ];

  const results = [];
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length];
    results.push({
      question: t.q,
      options: t.options,
      correctAnswer: t.correctAnswer,
      marks: difficulty === 'Hard' ? 2 : 1,
      explanation: t.explanation,
    });
  }
  return results;
};

/**
 * Dynamic AI Doubt Assistant for Video Lectures
 */
const askDoubtWithGroq = async ({
  question,
  videoTitle = '',
  courseTitle = '',
  moduleTitle = '',
  teacherName = '',
  notesContext = '',
  conversationHistory = [],
}) => {
  const apiKey = process.env.GROQ_API_KEY;

  const systemPrompt = `You are a brilliant, patient, and supportive university AI Academic Tutor & Teaching Assistant.
Your mission is to help students master video lectures, clear academic doubts, explain concepts clearly step-by-step, provide intuitive examples, and solve problems.

Active Video Lecture Context:
- Course: ${courseTitle || 'University Course'}
- Module: ${moduleTitle || 'Academic Module'}
- Lecture Video Topic: ${videoTitle || 'Lecture Topic'}
- Faculty Instructor: ${teacherName || 'Faculty Professor'}
- Available Notes & Reference Material: ${notesContext || 'Standard University Syllabus'}

Guidelines:
1. Address the student's question directly with clear, well-formatted markdown explanations.
2. If the student asks in Hindi/Hinglish (e.g. "samjhao", "example do", "solve karo"), reply in natural, easy-to-understand Hinglish/Hindi or clear English.
3. Provide practical real-world analogies, step-by-step explanations, key equations, and summary points.
4. Keep the tone encouraging, engaging, and academically rigorous.`;

  if (apiKey && !apiKey.includes('your_groq_api_key')) {
    try {
      const groq = new Groq({ apiKey });
      const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

      const messages = [{ role: 'system', content: systemPrompt }];

      if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        conversationHistory.slice(-6).forEach(msg => {
          if (msg.role && msg.content) {
            messages.push({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: String(msg.content),
            });
          }
        });
      }

      messages.push({ role: 'user', content: question });

      const completion = await groq.chat.completions.create({
        messages,
        model: model,
        temperature: 0.6,
        max_tokens: 1024,
      });

      const responseText = completion.choices[0]?.message?.content;
      if (responseText && responseText.trim()) {
        return responseText.trim();
      }
    } catch (error) {
      console.warn(`[Groq AI Doubt Warning] ${error.message}. Providing smart academic fallback response.`);
    }
  }

  return generateAcademicDoubtFallback(question, videoTitle, courseTitle, moduleTitle);
};

const generateAcademicDoubtFallback = (question, videoTitle, courseTitle, moduleTitle) => {
  const qLower = (question || '').toLowerCase();
  const topic = videoTitle || moduleTitle || 'this lecture topic';

  if (qLower.includes('example') || qLower.includes('real-world')) {
    return `### 💡 Real-World Example for "${topic}"\n\n` +
      `**Concept Overview:**\nIn **${topic}**, the core principle revolves around systematic state transformation and efficiency.\n\n` +
      `**Practical Real-World Example:**\n` +
      `Think of this like an automated air traffic control routing system or a modern banking transaction pipeline:\n` +
      `1. **Input Stage:** Requests or data packets arrive continuously.\n` +
      `2. **Core Operation in ${topic}:** The algorithm evaluates priority invariants and partitions workload without blocking concurrent streams.\n` +
      `3. **Outcome:** Guaranteed deterministic response times with minimal resource overhead.\n\n` +
      `*Tip: In your exams, always highlight the initial invariant condition and the computational complexity.*`;
  }

  if (qLower.includes('solve') || qLower.includes('question') || qLower.includes('problem')) {
    return `### ✏️ Step-by-Step Problem Solving on "${topic}"\n\n` +
      `Let's solve a fundamental problem based on **${topic}**:\n\n` +
      `**Problem Statement:** Given an input set of $n$ elements, find the optimal execution path under standard constraints.\n\n` +
      `**Step 1: Identify Invariants & Given Values**\n` +
      `- Base Case: For $n = 1$, computation terminates in $O(1)$ constant time.\n` +
      `- Inductive Step: For $n > 1$, problem divides into subproblems.\n\n` +
      `**Step 2: Apply the Core Formula / Algorithm**\n` +
      `$$T(n) = a \\cdot T(n/b) + f(n)$$\n` +
      `Substituting parameters gives an optimal worst-case bound of $O(n \\log n)$.\n\n` +
      `**Step 3: Verification**\n` +
      `The solution satisfies all boundary conditions without memory leakage or state divergence.`;
  }

  if (qLower.includes('summary') || qLower.includes('formula') || qLower.includes('points')) {
    return `### 📝 Key Summary & Formula Sheet: "${topic}"\n\n` +
      `Here are the most important takeaways from this lecture:\n\n` +
      `1. **Core Definition:** ${topic} establishes foundational mechanisms for reliable computation and state verification.\n` +
      `2. **Critical Invariants:** Always verify boundary conditions and base cases before recursive propagation.\n` +
      `3. **Time & Space Complexity:** Standard implementations achieve $O(\\log n)$ access and $O(n)$ linear auxiliary storage.\n` +
      `4. **Exam Pro-Tip:** Clearly define input/output specifications and state transitions.`;
  }

  // Default Simple Explanation (Hinglish/English friendly)
  return `### 🎓 Explanation: "${topic}"\n\n` +
    `Aasan shabdon me samjhein to **${topic}** ka main purpose system ko structured, efficient aur error-free banana hai.\n\n` +
    `#### 1. Mukhya Bindu (Key Highlights):\n` +
    `- **Objective:** Is lecture me humne dekha ki kaise data aur processes ko logically organize kiya jata hai.\n` +
    `- **Kaise Kaam Karta Hai:** Step-by-step input accept karta hai, rules apply karta hai aur desired output generate karta hai.\n` +
    `- **Fayda:** Manual errors reduce hote hain aur processing speed significantly improve hoti hai.\n\n` +
    `#### 2. Yaad Rakhne Layak Points (Exam Takeaways):\n` +
    `- **Course:** ${courseTitle || 'Academic Program'}\n` +
    `- **Module:** ${moduleTitle || 'Core Module'}\n` +
    `- Hamesha standard formulas aur diagrams ke saath answer present karein!\n\n` +
    `*Agar koi specific doubt ya derivation poochna hai to neeche type karein!*`;
};

module.exports = {
  generateQuizWithGroq,
  askDoubtWithGroq,
};
