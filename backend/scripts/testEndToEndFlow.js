require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');

const API_BASE = 'http://127.0.0.1:5000/api';

const request = (endpoint, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${endpoint}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const dataString = body ? JSON.stringify(body) : null;
    if (dataString) headers['Content-Length'] = Buffer.byteLength(dataString);

    const req = http.request(url, { method, headers }, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
};

const runE2E = async () => {
  console.log('\n===============================================================');
  console.log('  TESTING COMPLETE END-TO-END FLOW (ADMIN -> TEACHER -> STUDENT)');
  console.log('===============================================================\n');

  // STEP 1: ADMIN LOGIN
  console.log('[Step 1] Logging in as Admin...');
  const adminLoginRes = await request('/auth/login', 'POST', {
    email: process.env.ADMIN_EMAIL || 'kumarshubham3187@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@SecurePass2026!',
    role: 'admin',
  });
  if (adminLoginRes.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLoginRes.data.data.token;
  console.log('✓ Admin authenticated');

  // STEP 2: ADMIN CREATES TEACHER
  console.log('[Step 2] Admin creates a new Teacher...');
  const teacherEmail = `faculty.e2e.${Date.now()}@studyplatform.edu`;
  const teacherRes = await request('/teachers', 'POST', {
    name: 'Prof. Ananya Sen',
    email: teacherEmail,
    password: 'password123',
    department: 'Computer Science',
  }, adminToken);
  if (teacherRes.status !== 201) throw new Error('Teacher creation failed');
  const teacherId = teacherRes.data.data._id;
  console.log(`✓ Teacher created: ${teacherEmail} (ID: ${teacherId})`);

  // STEP 3: ADMIN CREATES SUBJECT
  console.log('[Step 3] Admin creates a Subject...');
  const subCode = `CS-E2E-${Math.floor(100 + Math.random() * 900)}`;
  const subjectRes = await request('/subjects', 'POST', {
    name: 'Distributed Systems & Cloud Computing',
    code: subCode,
    semester: '6th Semester',
    description: 'Cloud architectures, Paxos, Raft, and containerization',
  }, adminToken);
  if (subjectRes.status !== 201) throw new Error('Subject creation failed');
  const subjectId = subjectRes.data.data._id;
  console.log(`✓ Subject created: ${subCode} (ID: ${subjectId})`);

  // STEP 4: ADMIN CREATES COURSE
  console.log('[Step 4] Admin creates a Course linked to the Subject...');
  const courseRes = await request('/courses', 'POST', {
    title: 'Distributed Cloud Engineering Masterclass',
    courseCode: `DCE-${Math.floor(100 + Math.random() * 900)}`,
    subjectId,
    semester: '6th Semester',
    description: 'Comprehensive lecture series and hands-on assessments',
  }, adminToken);
  if (courseRes.status !== 201) throw new Error('Course creation failed');
  const courseId = courseRes.data.data._id;
  console.log(`✓ Course created: (ID: ${courseId})`);

  // STEP 5: ADMIN ALLOCATES COURSE & SUBJECT TO TEACHER
  console.log('[Step 5] Admin allocates Subject to Teacher...');
  const allocRes = await request('/allocations/sync', 'POST', {
    teacherId,
    subjectIds: [subjectId],
  }, adminToken);
  if (allocRes.status !== 200) throw new Error('Teacher allocation failed');
  console.log('✓ Subject and Course allocated to Teacher');

  // STEP 6: TEACHER LOGIN
  console.log('[Step 6] Teacher logs in...');
  const teacherLoginRes = await request('/auth/login', 'POST', {
    email: teacherEmail,
    password: 'password123',
    role: 'teacher',
  });
  if (teacherLoginRes.status !== 200) throw new Error('Teacher login failed');
  const teacherToken = teacherLoginRes.data.data.token;
  console.log('✓ Teacher authenticated');

  // STEP 7: TEACHER VERIFIES ALLOCATED SUBJECT
  console.log('[Step 7] Teacher checks assigned subjects...');
  const mySubjectsRes = await request('/teachers/my-subjects', 'GET', null, teacherToken);
  if (mySubjectsRes.status !== 200 || mySubjectsRes.data.data.length === 0) throw new Error('Teacher cannot see assigned subject');
  console.log(`✓ Teacher assigned subject confirmed: ${mySubjectsRes.data.data[0].name}`);

  // STEP 8: TEACHER CREATES MODULE
  console.log('[Step 8] Teacher creates a Module inside the Course...');
  const moduleRes = await request('/modules', 'POST', {
    courseId,
    title: 'Module 1: Distributed Consensus & Raft Protocol',
    description: 'State machine replication, leader election, and log compaction',
  }, teacherToken);
  if (moduleRes.status !== 201) throw new Error('Module creation failed');
  const moduleId = moduleRes.data.data._id;
  console.log(`✓ Module created: (ID: ${moduleId})`);

  // STEP 9: TEACHER UPLOADS VIDEO (CLOUDINARY METADATA)
  console.log('[Step 9] Teacher uploads lecture video...');
  const videoRes = await request('/videos', 'POST', {
    courseId,
    moduleId,
    title: 'Lecture 1.1: The Raft Consensus Algorithm',
    description: 'Visualizing leader election heartbeats and term incrementation',
    cloudinaryUrl: 'https://res.cloudinary.com/demo/video/upload/v1/study_platform/raft_consensus.mp4',
    duration: '22:15',
  }, teacherToken);
  if (videoRes.status !== 201) throw new Error('Video upload failed');
  const videoId = videoRes.data.data._id;
  console.log(`✓ Lecture video uploaded & published (ID: ${videoId})`);

  // STEP 10: TEACHER UPLOADS PDF NOTES
  console.log('[Step 10] Teacher uploads PDF notes...');
  const noteRes = await request('/notes', 'POST', {
    courseId,
    moduleId,
    title: 'Raft Paper Companion Notes PDF',
    description: 'Summary of Ongaro & Ousterhout Stanford consensus proofs',
    fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/study_platform/raft_summary.pdf',
  }, teacherToken);
  if (noteRes.status !== 201) throw new Error('PDF Notes upload failed');
  console.log('✓ PDF Notes uploaded & published');

  // STEP 11: TEACHER GENERATES AI QUIZ VIA GROQ
  console.log('[Step 11] Teacher generates AI Quiz (Groq API, custom count = 3)...');
  const aiQuizRes = await request('/ai/generate-quiz', 'POST', {
    topic: 'Raft Leader Election and Log Compaction',
    numQuestions: 3,
    difficulty: 'Medium',
    courseTitle: 'Distributed Cloud Engineering Masterclass',
  }, teacherToken);
  if (aiQuizRes.status !== 200 || !Array.isArray(aiQuizRes.data.data?.questions)) {
    throw new Error('AI Quiz generation failed');
  }
  const aiQuestions = aiQuizRes.data.data.questions;
  console.log(`✓ AI generated ${aiQuestions.length} MCQs via Groq!`);
  console.log(`  Sample Q1: "${aiQuestions[0].question.substring(0, 60)}..."`);

  // STEP 12: TEACHER REVIEWS, EDITS, AND PUBLISHES QUIZ
  console.log('[Step 12] Teacher reviews draft and publishes quiz...');
  // Edit Question 1 slightly as part of teacher review
  aiQuestions[0].question = `${aiQuestions[0].question} [Reviewed by Prof. Sen]`;

  const publishQuizRes = await request('/quizzes', 'POST', {
    courseId,
    moduleId,
    title: 'Raft Consensus Assessment Quiz',
    questions: aiQuestions,
    duration: 15,
    status: 'Published', // Marked as published after review
  }, teacherToken);
  if (publishQuizRes.status !== 201) throw new Error('Quiz publishing failed');
  const quizId = publishQuizRes.data.data._id;
  console.log(`✓ Quiz published to students: (ID: ${quizId})`);

  // STEP 13: STUDENT LOGS IN
  console.log('[Step 13] Student logs in...');
  const studentLoginRes = await request('/auth/login', 'POST', {
    email: 'aryan.nair@student.edu',
    password: 'password123',
    role: 'student',
  });
  if (studentLoginRes.status !== 200) throw new Error('Student login failed');
  const studentToken = studentLoginRes.data.data.token;
  console.log('✓ Student authenticated');

  // STEP 14: STUDENT ENROLLS IN COURSE
  console.log('[Step 14] Student enrolls in Course...');
  const enrollRes = await request('/enrollments', 'POST', { courseId }, studentToken);
  if (enrollRes.status !== 201) throw new Error('Student enrollment failed');
  console.log('✓ Student successfully enrolled in Course');

  // STEP 15: STUDENT TAKES QUIZ (VERIFY ANSWERS ARE STRIPPED BEFOREHAND)
  console.log('[Step 15] Student fetches quiz (verifying correct answers are hidden)...');
  const studentQuizView = await request(`/quizzes/${quizId}`, 'GET', null, studentToken);
  if (studentQuizView.status !== 200) throw new Error('Student cannot view quiz');
  const fetchedQuestions = studentQuizView.data.data.questions;
  if (fetchedQuestions[0].correctAnswer) throw new Error('SECURITY VIOLATION: Correct answer exposed to student!');
  console.log('✓ Correct answers securely hidden from student before submission');

  // STEP 16: STUDENT SUBMITS QUIZ ANSWERS
  console.log('[Step 16] Student submits answers...');
  const submittedAnswers = [
    { questionId: fetchedQuestions[0]._id, selectedAnswer: aiQuestions[0].correctAnswer }, // Correct
    { questionId: fetchedQuestions[1]._id, selectedAnswer: 'Deliberate Wrong Choice' },    // Wrong
    { questionId: fetchedQuestions[2]._id, selectedAnswer: aiQuestions[2].correctAnswer }, // Correct
  ];

  const submitRes = await request('/quiz-attempts', 'POST', {
    quizId,
    answers: submittedAnswers,
  }, studentToken);

  if (submitRes.status !== 201) throw new Error('Quiz evaluation failed');
  const attemptResult = submitRes.data.data;
  console.log(`✓ Quiz Evaluated Immediately!`);
  console.log(`  Score: ${attemptResult.score} / ${attemptResult.totalMarks}`);
  console.log(`  Correct: ${attemptResult.correctCount}`);
  console.log(`  Wrong: ${attemptResult.wrongCount}`);
  console.log(`  Percentage: ${attemptResult.percentage}%`);
  console.log(`  Itemized breakdown count: ${attemptResult.breakdown.length}`);
  console.log(`  Q1 Feedback: Your Answer: "${attemptResult.breakdown[0].selectedAnswer}", Correct: "${attemptResult.breakdown[0].correctAnswer}", isCorrect: ${attemptResult.breakdown[0].isCorrect}`);

  // STEP 17: TEACHER OPENS QUIZ RESULTS & CHECKS STUDENT PERFORMANCE
  console.log('[Step 17] Teacher retrieves Quiz Results for assigned course...');
  const teacherResultsRes = await request('/quiz-attempts/teacher-results', 'GET', null, teacherToken);
  if (teacherResultsRes.status !== 200) throw new Error('Teacher quiz results fetch failed');
  const results = teacherResultsRes.data.data;
  const match = results.find(r => r.quizTitle === 'Raft Consensus Assessment Quiz');
  if (!match) throw new Error('Teacher cannot see student quiz attempt!');
  console.log(`✓ Teacher successfully views student performance:`);
  console.log(`  Student: ${match.studentName} (${match.studentEmail})`);
  console.log(`  Quiz: ${match.quizTitle}`);
  console.log(`  Course: ${match.courseTitle}`);
  console.log(`  Score: ${match.score}/${match.totalMarks} (${match.percentage}%)`);
  console.log(`  Correct/Wrong: ${match.correctCount} / ${match.wrongCount}`);
  console.log(`  Date: ${match.attemptDate}`);

  // CLEANUP TEST ENTITIES
  console.log('\n[Cleanup] Cleaning up created test course & subject...');
  await request(`/courses/${courseId}`, 'DELETE', null, adminToken);
  await request(`/subjects/${subjectId}`, 'DELETE', null, adminToken);
  await request(`/teachers/${teacherId}`, 'DELETE', null, adminToken);

  console.log('\n===============================================================');
  console.log('  ALL STEPS IN THE END-TO-END FLOW SUCCEEDED WITH 100% SUCCESS!');
  console.log('===============================================================\n');
};

runE2E().catch(err => {
  console.error('\n❌ E2E Flow Failed:', err);
  process.exit(1);
});
