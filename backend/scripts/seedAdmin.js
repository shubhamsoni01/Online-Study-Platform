require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Course = require('../models/Course');
const TeacherAllocation = require('../models/TeacherAllocation');
const Module = require('../models/Module');
const Video = require('../models/Video');
const Note = require('../models/Note');
const Quiz = require('../models/Quiz');
const Announcement = require('../models/Announcement');
const Book = require('../models/Book');
const Schedule = require('../models/Schedule');

const seedAdminAndData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('[Seed Error] MONGODB_URI is not defined in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB database successfully.');

    // 1. Seed Primary Admin
    const adminEmail = (process.env.ADMIN_EMAIL || 'kumarshubham3187@gmail.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@SecurePass2026!';

    let admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      admin = await Admin.create({
        name: 'System Administrator',
        email: adminEmail,
        password: adminPassword,
        photo: 'AD',
        role: 'admin',
        status: 'Active',
      });
      console.log(`[Seed] Primary Admin seeded successfully: ${adminEmail}`);
    } else {
      console.log(`[Seed] Primary Admin already exists: ${adminEmail} (Skipping duplicate creation)`);
    }

    // 2. Seed Foundation Subjects if none exist
    const subjectCount = await Subject.countDocuments();
    let s1, s2, s3, s4;
    if (subjectCount === 0) {
      [s1, s2, s3, s4] = await Subject.create([
        {
          name: 'Data Structures',
          code: 'CS301',
          semester: '3rd Semester',
          description: 'Linear & non-linear structures, binary search trees, hashing, and algorithms.',
        },
        {
          name: 'Database Management System',
          code: 'CS302',
          semester: '3rd Semester',
          description: 'Relational data models, SQL querying, normalization forms, and transaction processing.',
        },
        {
          name: 'Computer Networks',
          code: 'CS401',
          semester: '4th Semester',
          description: 'OSI 7-layer architecture, TCP/IP protocols, subnetting, and socket programming.',
        },
        {
          name: 'Operating System',
          code: 'CS402',
          semester: '4th Semester',
          description: 'Process scheduling, concurrency primitives, virtual memory, and file systems.',
        },
      ]);
      console.log('[Seed] 4 Curriculum Subjects seeded successfully.');
    } else {
      [s1, s2, s3, s4] = await Subject.find().limit(4);
    }

    // 3. Seed Sample Courses
    const courseCount = await Course.countDocuments();
    let c1;
    if (courseCount === 0 && s1) {
      [c1] = await Course.create([
        {
          title: 'Data Structures & Algorithms',
          courseCode: 'CS301-A',
          subjectId: s1._id,
          semester: '3rd Semester',
          description: 'Comprehensive DSA course covering asymptotic complexity, linked lists, trees, and graphs.',
        },
        {
          title: 'Relational Database Engineering',
          courseCode: 'CS302-A',
          subjectId: s2._id,
          semester: '3rd Semester',
          description: 'Hands-on relational architecture, SQL optimizations, and transaction ACID properties.',
        },
      ]);
      console.log('[Seed] Foundation Courses seeded successfully.');
    } else {
      c1 = await Course.findOne();
    }

    // 4. Seed Primary Teacher (Rahul Kumar)
    const teacherEmail = 'rahul.kumar@studyplatform.edu';
    let teacher = await Teacher.findOne({ email: teacherEmail });
    if (!teacher) {
      teacher = await Teacher.create({
        name: 'Rahul Kumar',
        email: teacherEmail,
        password: 'password123',
        department: 'Computer Science',
        photo: 'RK',
        status: 'Active',
      });
      console.log(`[Seed] Default Teacher seeded: ${teacherEmail} (Password: password123)`);

      // Allocate subjects to Rahul Kumar: Data Structures, DBMS, Computer Networks
      if (s1 && s2 && s3) {
        await TeacherAllocation.create([
          { teacherId: teacher._id, subjectId: s1._id, courseId: c1?._id || null },
          { teacherId: teacher._id, subjectId: s2._id },
          { teacherId: teacher._id, subjectId: s3._id },
        ]);
        console.log('[Seed] TeacherAllocations created for Rahul Kumar (3 subjects).');
      }
    }

    // 5. Seed Primary Student (Aryan Nair)
    const studentEmail = 'aryan.nair@student.edu';
    let student = await Student.findOne({ email: studentEmail });
    if (!student) {
      student = await Student.create({
        name: 'Aryan Nair',
        email: studentEmail,
        password: 'password123',
        department: 'Computer Science',
        semester: '3rd Semester',
        rollNumber: 'CS-2024-001',
        photo: 'AN',
        status: 'Active',
      });
      console.log(`[Seed] Default Student seeded: ${studentEmail} (Password: password123)`);
    }

    // 6. Seed Sample Module & Content for Data Structures
    if (c1 && teacher) {
      const moduleCount = await Module.countDocuments({ courseId: c1._id });
      if (moduleCount === 0) {
        const m1 = await Module.create({
          courseId: c1._id,
          subjectId: s1?._id || null,
          teacherId: teacher._id,
          title: 'Module 1 – Introduction to Time Complexity',
          description: 'Understanding Big-O, Big-Omega, and Theta notations with formal proofs.',
          order: 1,
        });

        // Seed Video
        await Video.create({
          courseId: c1._id,
          moduleId: m1._id,
          teacherId: teacher._id,
          title: '1.1 Complexity Analysis & Asymptotic Bounds',
          description: 'Deriving worst-case versus amortized performance for nested iteration.',
          cloudinaryUrl: 'https://res.cloudinary.com/demo/video/upload/v1/study_platform/dsa_intro.mp4',
          duration: '22:15',
          status: 'Published',
        });

        // Seed Note
        await Note.create({
          courseId: c1._id,
          moduleId: m1._id,
          teacherId: teacher._id,
          title: 'Module 1 Asymptotic Proofs Reference Slide',
          description: 'Comprehensive PDF covering Big-O definitions and recurrence trees.',
          fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/study_platform/Module1_Complexity.pdf',
          status: 'Published',
        });

        // Seed Quiz
        await Quiz.create({
          courseId: c1._id,
          moduleId: m1._id,
          teacherId: teacher._id,
          title: 'Module 1 Asymptotic Complexity Quiz',
          questions: [
            {
              question: 'What is the time complexity of binary search on a sorted array of size n?',
              options: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
              correctAnswer: 'O(log n)',
              marks: 1,
              explanation: 'The search interval is halved at each comparison, yielding log2(n) steps.',
            },
            {
              question: 'Which notation represents the tight asymptotic bound?',
              options: ['Big-O', 'Big-Omega', 'Theta (Θ)', 'Little-o'],
              correctAnswer: 'Theta (Θ)',
              marks: 1,
              explanation: 'Theta bounds a function from both above and below within constant factors.',
            },
          ],
          totalMarks: 2,
          duration: 15,
          status: 'Published',
        });

        console.log('[Seed] Sample Module, Video, Note & Quiz created under Data Structures.');
      }
    }

    // 7. Seed Sample Announcements
    const annCount = await Announcement.countDocuments();
    if (annCount === 0 && teacher) {
      await Announcement.create([
        {
          title: 'Data Structures Lab 2 Submission Extended',
          message: 'Students can submit the Doubly Linked List priority queue assignment by Friday. Ensure all test cases compile without memory leaks.',
          teacherId: teacher._id,
          teacherName: teacher.name,
          subjectName: 'Data Structures',
          date: '2026-09-02',
          status: 'Active',
        },
      ]);
      console.log('[Seed] Sample faculty announcement seeded.');
    }

    // 8. Seed Sample E-Library Books
    const bookCount = await Book.countDocuments();
    if (bookCount === 0 && teacher) {
      await Book.create([
        {
          bookName: 'Data Structures Using C',
          author: 'Reema Thareja',
          subjectName: 'Data Structures',
          category: 'Data Structures',
          description: 'Complete university textbook covering linear structures, search trees, and algorithm design.',
          fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/study_platform/books/ds_thareja.pdf',
          uploadedBy: teacher._id,
          status: 'Active',
        },
        {
          bookName: 'Database System Concepts (7th Edition)',
          author: 'Silberschatz, Korth, Sudarshan',
          subjectName: 'Database Management System',
          category: 'DBMS',
          description: 'Foundational university textbook detailing relational calculus, SQL, indexing, and transactions.',
          fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/study_platform/books/dbms_korth.pdf',
          uploadedBy: teacher._id,
          status: 'Active',
        },
      ]);
      console.log('[Seed] Digital E-Library books seeded.');
    }

    // 9. Seed Sample Schedule
    const schCount = await Schedule.countDocuments();
    if (schCount === 0 && s1 && teacher) {
      await Schedule.create([
        {
          subjectId: s1._id,
          teacherId: teacher._id,
          date: '2026-09-02',
          startTime: '09:00 AM',
          endTime: '10:30 AM',
          topic: 'Module 1: Asymptotic Complexity Analysis',
          classType: 'Lecture',
          status: 'Scheduled',
        },
      ]);
      console.log('[Seed] Class schedule entry seeded.');
    }

    console.log('\n==================================================');
    console.log(' DATABASE SEEDING COMPLETED SUCCESSFULLY');
    console.log('==================================================');
    console.log(` Admin Login:   ${adminEmail} | Password: ${adminPassword}`);
    console.log(` Teacher Login: rahul.kumar@studyplatform.edu | Password: password123`);
    console.log(` Student Login: aryan.nair@student.edu | Password: password123`);
    console.log('==================================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Fatal Error]', error);
    process.exit(1);
  }
};

seedAdminAndData();
