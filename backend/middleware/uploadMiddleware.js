const multer = require('multer');

// Memory storage keeps file buffers in memory for direct Cloudinary stream upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    // PDFs
    'application/pdf',
    // Images
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    // Videos
    'video/mp4',
    'video/webm',
    'video/x-matroska',
    'video/quicktime',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, Images, MP4/WebM videos.`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB maximum size
  },
  fileFilter,
});

upload.upload = upload;
module.exports = upload;
