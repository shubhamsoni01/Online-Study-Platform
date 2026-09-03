require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Route Handlers
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const courseRoutes = require('./routes/courseRoutes');
const allocationRoutes = require('./routes/allocationRoutes');
const moduleRoutes = require('./routes/moduleRoutes');
const videoRoutes = require('./routes/videoRoutes');
const noteRoutes = require('./routes/noteRoutes');
const quizRoutes = require('./routes/quizRoutes');
const quizAttemptRoutes = require('./routes/quizAttemptRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const progressRoutes = require('./routes/progressRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const bookRoutes = require('./routes/bookRoutes');
const commentRoutes = require('./routes/commentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const aiRoutes = require('./routes/aiRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const userRoutes = require('./routes/userRoutes');

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  // Join a personal room based on user ID for direct messaging
  socket.on('join_user', (userId) => {
    socket.join(userId);
  });

  socket.on('send_direct_message', (data) => {
    // Deliver to recipient's room
    if (data.receiverId) {
      io.to(data.receiverId).emit('receive_direct_message', data);
    }
  });

  socket.on('disconnect', () => {});
});

// Security & Parsing Middleware
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve real uploaded files statically (photos, videos, PDFs, books)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files (HTML, JS, CSS, assets)
const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});
app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(frontendDir, 'admin.html'));
});
app.get(['/teacher', '/teacher/*'], (req, res) => {
  res.sendFile(path.join(frontendDir, 'teacher.html'));
});
app.get(['/student', '/student/*'], (req, res) => {
  res.sendFile(path.join(frontendDir, 'student.html'));
});

// Rate Limiting for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many login attempts from this IP, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    success: true,
    message: 'Online Study Platform API is operating normally',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseName: mongoose.connection.name,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/quiz-attempts', quizAttemptRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Cloudflare Tunnel Keep-Alive Stability
server.keepAliveTimeout = 65000; // Higher than Cloudflare's 60s proxy keep-alive
server.headersTimeout = 66000; // Must be slightly higher than keepAliveTimeout

const PORT = process.env.PORT || 5000;

if (require.main === module || !process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Online Study Platform API Server Started`);
    console.log(`📡 Port: ${PORT} (Bound to 0.0.0.0)`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
    console.log(`==================================================\n`);
  });
}

module.exports = app;
module.exports.server = server;
