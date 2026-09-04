const express = require('express');
const router = express.Router();
const {
  streamVideoById,
  viewNotePdfById,
  downloadNotePdfById,
  viewBookPdfById,
  downloadBookPdfById,
  viewPdfByQuery,
  downloadByQuery,
  streamByQuery,
} = require('../controllers/mediaController');

// Dedicated Media Resource Endpoints
router.get('/video/:id/stream', streamVideoById);
router.get('/note/:id/view', viewNotePdfById);
router.get('/note/:id/download', downloadNotePdfById);
router.get('/book/:id/view', viewBookPdfById);
router.get('/book/:id/download', downloadBookPdfById);

// Query-based Universal Fallbacks
router.get('/view-pdf', viewPdfByQuery);
router.get('/download', downloadByQuery);
router.get('/stream', streamByQuery);

module.exports = router;
