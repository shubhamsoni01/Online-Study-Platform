const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
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
app.set('trust proxy', 1);
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

// Auto-ensure DB connection for API requests
app.use('/api', async (req, res, next) => {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (e) {}
  }
  next();
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    success: true,
    message: 'Online Study Platform API is operating normally',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseName: mongoose.connection.name || null,
    dbReadyState: mongoose.connection.readyState,
    dbError: connectDB.getLastError ? connectDB.getLastError() : null,
    hasMongoUriEnv: !!process.env.MONGODB_URI,
    mongoUriLength: (process.env.MONGODB_URI || '').length,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Universal File Download Endpoint (Mobile & Desktop Attachment Forced)
app.get('/api/download', async (req, res) => {
  try {
    let { url, filename } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL parameter is required' });
    }

    let fileUrl = decodeURIComponent(url).trim();
    if (fileUrl.startsWith('/') && !fileUrl.startsWith('//')) {
      fileUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;
    }

    const extMatch = fileUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const ext = extMatch ? `.${extMatch[1]}` : '.pdf';
    let safeFilename = (filename || 'study-document').replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeFilename.toLowerCase().endsWith(ext.toLowerCase())) {
      safeFilename += ext;
    }

    // 1. Local filesystem handling
    if (fileUrl.includes('/uploads/')) {
      const fs = require('fs');
      const relPath = fileUrl.split('/uploads/')[1].split('?')[0];
      const localFilePath = path.join(__dirname, 'uploads', relPath);
      if (fs.existsSync(localFilePath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Type', ext === '.pdf' ? 'application/pdf' : 'application/octet-stream');
        return res.sendFile(localFilePath);
      }
    }

    // 2. Cloudinary attachment shortcut if Cloudinary URL
    if (fileUrl.includes('cloudinary.com') && fileUrl.includes('/upload/') && !fileUrl.includes('fl_attachment')) {
      fileUrl = fileUrl.replace('/upload/', `/upload/fl_attachment:${encodeURIComponent(safeFilename)}/`);
    }

    // 3. Stream from remote HTTP/HTTPS resource
    const isHttps = fileUrl.startsWith('https:');
    const client = isHttps ? require('https') : require('http');

    const downloadStream = (targetUrl, redirectsLeft = 3) => {
      const parsedUrl = new URL(targetUrl);
      const reqClient = parsedUrl.protocol === 'https:' ? require('https') : require('http');

      reqClient.get(targetUrl, (proxyRes) => {
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location && redirectsLeft > 0) {
          let redirUrl = proxyRes.headers.location;
          if (redirUrl.startsWith('/')) {
            redirUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirUrl}`;
          }
          return downloadStream(redirUrl, redirectsLeft - 1);
        }

        if (proxyRes.statusCode >= 400) {
          return res.redirect(targetUrl);
        }

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/pdf');
        if (proxyRes.headers['content-length']) {
          res.setHeader('Content-Length', proxyRes.headers['content-length']);
        }
        res.setHeader('Cache-Control', 'public, max-age=3600');
        proxyRes.pipe(res);
      }).on('error', (err) => {
        console.error('[Download proxy error]', err.message);
        res.redirect(targetUrl);
      });
    };

    downloadStream(fileUrl);
  } catch (err) {
    console.error('[Universal Download Error]', err);
    res.status(500).json({ success: false, message: 'Failed to process file download' });
  }
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
