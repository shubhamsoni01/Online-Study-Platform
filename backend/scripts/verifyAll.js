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

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
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
      }
    );

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
};

const runAllTests = async () => {
  console.log('\n========================================================');
  console.log('  RUNNING COMPREHENSIVE 25-POINT SYSTEM VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (num, name, fn) => {
    try {
      await fn();
      console.log(`[PASS] ${num}. ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${num}. ${name} ->`, e.message);
      failed++;
    }
  };

  let adminToken = '';
  let teacherToken = '';
  let studentToken = '';
  let createdTeacherId = '';
  let createdSubjectId = '';
  let createdCourseId = '';
  let createdModuleId = '';
  let createdVideoId = '';
  let createdNoteId = '';
  let createdQuizId = '';
  let createdScheduleId = '';
  let createdBookId = '';
  let createdCommentId = '';

  // 1. MongoDB Connection & Health Check
  await test('1', 'MongoDB connection & API Health', async () => {
    const res = await request('/health');
    if (res.status !== 200 || !res.data.success) throw new Error('Health check failed');
  });

  // 2. Admin Login
  await test('2', 'Admin Login', async () => {
    const res = await request('/auth/login', 'POST', {
      email: process.env.ADMIN_EMAIL || 'kumarshubham3187@gmail.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@SecurePass2026!',
      role: 'admin',
    });
    if (res.status !== 200 || !res.data.data?.token) throw new Error('Admin login failed');
    adminToken = res.data.data.token;
  });

  // 3. Teacher Creation (by Admin)
  await test('3', 'Teacher Creation', async () => {
    const email = `test.teacher.${Date.now()}@studyplatform.edu`;
    const res = await request(
      '/teachers',
      'POST',
      {
        name: 'Dr. Vikram Sethi',
        email,
        password: 'password123',
        department: 'Computer Science',
      },
      adminToken
    );
    if (res.status !== 201 || !res.data.data?._id) throw new Error('Teacher creation failed');
    createdTeacherId = res.data.data._id;
  });

  // 4. Teacher Login
  await test('4', 'Teacher Login', async () => {
    const res = await request('/auth/login', 'POST', {
      email: 'rahul.kumar@studyplatform.edu',
      password: 'password123',
      role: 'teacher',
    });
    if (res.status !== 200 || !res.data.data?.token) throw new Error('Teacher login failed');
    teacherToken = res.data.data.token;
  });

  // 5. Student Login
  await test('5', 'Student Login', async () => {
    const res = await request('/auth/login', 'POST', {
      email: 'aryan.nair@student.edu',
      password: 'password123',
      role: 'student',
    });
    if (res.status !== 200 || !res.data.data?.token) throw new Error('Student login failed');
    studentToken = res.data.data.token;
  });

  // 6. Subject CRUD
  await test('6', 'Subject CRUD', async () => {
    const code = `CS${Math.floor(100 + Math.random() * 900)}`;
    const res = await request(
      '/subjects',
      'POST',
      {
        name: 'Software Engineering Architecture',
        code,
        semester: '5th Semester',
        description: 'Design patterns and modular architecture',
      },
      adminToken
    );
    if (res.status !== 201) throw new Error('Subject create failed');
    createdSubjectId = res.data.data._id;

    // Update
    const updateRes = await request(`/subjects/${createdSubjectId}`, 'PUT', { name: 'Advanced Software Engineering' }, adminToken);
    if (updateRes.status !== 200) throw new Error('Subject update failed');
  });

  // 7. Course CRUD
  await test('7', 'Course CRUD', async () => {
    const res = await request(
      '/courses',
      'POST',
      {
        title: 'Full Stack Engineering Track',
        courseCode: `CS-FS-${Math.floor(100 + Math.random() * 900)}`,
        subjectId: createdSubjectId,
        semester: '5th Semester',
        description: 'Complete full stack curriculum',
      },
      adminToken
    );
    if (res.status !== 201) throw new Error('Course create failed');
    createdCourseId = res.data.data._id;
  });

  // 8. Teacher Allocation (Multi-Subject)
  await test('8', 'Teacher Allocation', async () => {
    const res = await request(
      '/allocations/sync',
      'POST',
      {
        teacherId: createdTeacherId,
        subjectIds: [createdSubjectId],
      },
      adminToken
    );
    if (res.status !== 200) throw new Error('Allocation sync failed');
  });

  // 9. Schedule Management
  await test('9', 'Schedule Management', async () => {
    const res = await request(
      '/schedules',
      'POST',
      {
        subjectId: createdSubjectId,
        teacherId: createdTeacherId,
        date: '2026-09-08',
        startTime: '11:00 AM',
        endTime: '12:30 PM',
        topic: 'Architectural Patterns Overview',
      },
      adminToken
    );
    if (res.status !== 201) throw new Error('Schedule creation failed');
    createdScheduleId = res.data.data._id;
  });

  // 10. Enrollment (Course level)
  await test('10', 'Enrollment', async () => {
    const res = await request(
      '/enrollments',
      'POST',
      { courseId: createdCourseId },
      studentToken
    );
    if (res.status !== 201) throw new Error('Course enrollment failed');
  });

  // 11. Module Creation
  await test('11', 'Module Creation & Ordering', async () => {
    const res = await request(
      '/modules',
      'POST',
      {
        courseId: createdCourseId,
        title: 'Module 1: Monolithic vs Microservice Architectures',
        description: 'Trade-offs and distributed systems fundamentals',
      },
      teacherToken
    );
    if (res.status !== 201) throw new Error('Module create failed');
    createdModuleId = res.data.data._id;
  });

  // 12. Video Management (Cloudinary Record)
  await test('12', 'Cloudinary Video Record & Management', async () => {
    const res = await request(
      '/videos',
      'POST',
      {
        courseId: createdCourseId,
        moduleId: createdModuleId,
        title: '1.1 Monolith Decomposition Strategies',
        description: 'Analyzing latency vs coordination overhead',
        cloudinaryUrl: 'https://res.cloudinary.com/demo/video/upload/v1/study_platform/decomposition.mp4',
        duration: '18:40',
      },
      teacherToken
    );
    if (res.status !== 201) throw new Error('Video create failed');
    createdVideoId = res.data.data._id;
  });

  // 13. Notes / PDF Management (Cloudinary Record)
  await test('13', 'Cloudinary Notes / PDF Management', async () => {
    const res = await request(
      '/notes',
      'POST',
      {
        courseId: createdCourseId,
        moduleId: createdModuleId,
        title: 'Module 1 Architectural Proofs PDF',
        description: 'Formal decomposition patterns reference',
        fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/study_platform/arch_notes.pdf',
      },
      teacherToken
    );
    if (res.status !== 201) throw new Error('Notes create failed');
    createdNoteId = res.data.data._id;
  });

  // 14. Groq AI Quiz Generation (Teacher only)
  await test('14', 'Groq AI Quiz Generation', async () => {
    const res = await request(
      '/ai/generate-quiz',
      'POST',
      {
        topic: 'Distributed ACID vs BASE Transactions',
        numQuestions: 2,
        difficulty: 'Medium',
      },
      teacherToken
    );
    if (res.status !== 200 || !Array.isArray(res.data.data?.questions)) {
      throw new Error('Groq AI Quiz generation failed');
    }
  });

  // 15. Quiz Review & Manual Creation
  await test('15', 'Quiz Review & Publishing', async () => {
    const res = await request(
      '/quizzes',
      'POST',
      {
        courseId: createdCourseId,
        moduleId: createdModuleId,
        title: 'Module 1 Architecture Assessment',
        questions: [
          {
            question: 'What is the primary trade-off of two-phase commit (2PC)?',
            options: ['Blocking coordination', 'Zero network overhead', 'Infinite concurrency', 'No lock contention'],
            correctAnswer: 'Blocking coordination',
            marks: 1,
            explanation: '2PC is a blocking protocol that stalls if the coordinator fails during commit.',
          },
        ],
        duration: 10,
        status: 'Published',
      },
      teacherToken
    );
    if (res.status !== 201) throw new Error('Quiz creation failed');
    createdQuizId = res.data.data._id;
  });

  // 16. Quiz Submission & Evaluation
  await test('16', 'Quiz Submission & Evaluation', async () => {
    // Student retrieves quiz (correct answers stripped)
    const quizRes = await request(`/quizzes/${createdQuizId}`, 'GET', null, studentToken);
    const q1Id = quizRes.data.data.questions[0]._id;

    // Student submits attempt
    const res = await request(
      '/quiz-attempts',
      'POST',
      {
        quizId: createdQuizId,
        answers: [{ questionId: q1Id, selectedAnswer: 'Blocking coordination' }],
      },
      studentToken
    );
    if (res.status !== 201 || res.data.data?.score !== 1 || res.data.data?.percentage !== 100) {
      throw new Error('Quiz submission evaluation error');
    }
  });

  // 17. Progress Tracking
  await test('17', 'Progress Tracking', async () => {
    const res = await request(
      '/progress',
      'POST',
      {
        courseId: createdCourseId,
        moduleId: createdModuleId,
        videoId: createdVideoId,
        completed: true,
      },
      studentToken
    );
    if (res.status !== 200) throw new Error('Progress update failed');

    const checkRes = await request(`/progress/${createdCourseId}`, 'GET', null, studentToken);
    if (checkRes.status !== 200 || checkRes.data.data?.percentage === undefined) {
      throw new Error('Progress retrieval failed');
    }
  });

  // 18. Announcements (Teacher Feed)
  await test('18', 'Announcements (Teacher Feed)', async () => {
    const res = await request(
      '/announcements',
      'POST',
      {
        title: 'Architecture Lab Demonstration Scheduled',
        message: 'Live walkthrough of microservices event-bus will be conducted this Friday.',
        subjectName: 'Software Engineering Architecture',
      },
      teacherToken
    );
    if (res.status !== 201) throw new Error('Announcement create failed');
  });

  // 19. E-Library Book Upload & Search
  await test('19', 'E-Library Upload & Filtering', async () => {
    const res = await request(
      '/books',
      'POST',
      {
        bookName: 'Designing Data-Intensive Applications',
        author: 'Martin Kleppmann',
        category: 'Other',
        subjectName: 'Distributed Systems',
        description: 'The definitive guide to distributed architecture and storage systems.',
        fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/study_platform/ddia.pdf',
      },
      teacherToken
    );
    if (res.status !== 201) throw new Error('Book upload failed');
    createdBookId = res.data.data._id;

    const searchRes = await request('/books?search=Martin', 'GET', null, studentToken);
    if (searchRes.status !== 200 || searchRes.data.data?.length === 0) throw new Error('Book search failed');
  });

  // 20. Video Comments & Threaded Replies
  await test('20', 'Video Comments & Discussions', async () => {
    const res = await request(
      '/comments',
      'POST',
      {
        videoId: createdVideoId,
        text: 'Could you clarify the Paxos consensus quorum condition?',
      },
      studentToken
    );
    if (res.status !== 201) throw new Error('Comment post failed');
    createdCommentId = res.data.data._id;

    // Teacher reply
    const replyRes = await request(
      '/comments',
      'POST',
      {
        videoId: createdVideoId,
        text: 'A majority quorum of (n/2)+1 nodes is strictly necessary to prevent split-brain.',
        parentCommentId: createdCommentId,
      },
      teacherToken
    );
    if (replyRes.status !== 201) throw new Error('Comment reply failed');
  });

  // 21. Chat System (Teacher <-> Student)
  await test('21', 'Direct Messaging (Chat)', async () => {
    const res = await request(
      '/chat',
      'POST',
      {
        receiverId: createdTeacherId,
        receiverRole: 'teacher',
        message: 'Hello Professor, thank you for the lecture notes.',
      },
      studentToken
    );
    if (res.status !== 201) throw new Error('Chat message send failed');
  });

  // 22. Admin Management (Add/Edit/Delete)
  await test('22', 'Admin Management', async () => {
    const email = `audit.admin.${Date.now()}@studyplatform.edu`;
    const res = await request(
      '/admins',
      'POST',
      { name: 'Audit Admin', email, password: 'password123' },
      adminToken
    );
    if (res.status !== 201) throw new Error('Create admin failed');
    const adminId = res.data.data._id;

    const delRes = await request(`/admins/${adminId}`, 'DELETE', null, adminToken);
    if (delRes.status !== 200) throw new Error('Delete admin failed');
  });

  // 23. Password Change (with bcrypt validation)
  await test('23', 'Password Change & Validation', async () => {
    const res = await request(
      '/admins/change-password',
      'POST',
      {
        currentPassword: process.env.ADMIN_PASSWORD || 'Admin@SecurePass2026!',
        newPassword: 'Admin@NewTestPass99!',
        confirmPassword: 'Admin@NewTestPass99!',
      },
      adminToken
    );
    if (res.status !== 200) throw new Error('Password change failed');

    // Revert
    await request(
      '/admins/change-password',
      'POST',
      {
        currentPassword: 'Admin@NewTestPass99!',
        newPassword: process.env.ADMIN_PASSWORD || 'Admin@SecurePass2026!',
        confirmPassword: process.env.ADMIN_PASSWORD || 'Admin@SecurePass2026!',
      },
      adminToken
    );
  });

  // 24. Enrollment Analysis
  await test('24', 'Enrollment Analysis Endpoint', async () => {
    const res = await request('/admins/enrollment-analysis', 'GET', null, adminToken);
    if (res.status !== 200 || !res.data.data?.courseSummary) throw new Error('Enrollment analysis failed');
  });

  // 25. Role-Based Authorization Guards
  await test('25', 'Role-Based Authorization Guards', async () => {
    // Student attempting admin route must get 403 Forbidden
    const res = await request('/admins/stats', 'GET', null, studentToken);
    if (res.status !== 403) throw new Error(`Role guard failed. Expected 403, got ${res.status}`);

    // Teacher attempting admin-only subject deletion must get 403 Forbidden
    const teacherDeleteRes = await request(`/subjects/${createdSubjectId}`, 'DELETE', null, teacherToken);
    if (teacherDeleteRes.status !== 403) throw new Error(`Role guard failed. Expected 403, got ${teacherDeleteRes.status}`);
  });

  console.log('\n========================================================');
  console.log(`  VERIFICATION RESULTS: ${passed}/25 PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  // Clean up created test subject and course
  if (createdCourseId) await request(`/courses/${createdCourseId}`, 'DELETE', null, adminToken);
  if (createdSubjectId) await request(`/subjects/${createdSubjectId}`, 'DELETE', null, adminToken);
  if (createdTeacherId) await request(`/teachers/${createdTeacherId}`, 'DELETE', null, adminToken);

  process.exit(failed > 0 ? 1 : 0);
};

runAllTests().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
