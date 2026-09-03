const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

/**
 * Universal Secure Media Upload Endpoint
 * POST /api/upload
 * multipart form-data: field 'file', optional field 'folder', optional field 'resourceType'
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const folder = req.body.folder || 'study_platform';
    let resourceType = req.body.resourceType || 'auto';

    if (req.file.mimetype.startsWith('video/')) {
      resourceType = 'video';
    } else if (req.file.mimetype === 'application/pdf') {
      resourceType = 'raw';
    } else if (req.file.mimetype.startsWith('image/')) {
      resourceType = 'image';
    }

    const result = await uploadToCloudinary(req.file.buffer, folder, resourceType);

    res.json({
      success: true,
      message: 'File uploaded successfully to cloud storage',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
