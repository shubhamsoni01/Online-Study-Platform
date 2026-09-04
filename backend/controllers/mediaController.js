const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const Video = require('../models/Video');
const Note = require('../models/Note');
const Book = require('../models/Book');

/**
 * Helper: Resolve absolute local path from relative /uploads/... URL or storage path
 */
function resolveLocalPath(fileUrlOrPath) {
  if (!fileUrlOrPath) return null;
  const clean = fileUrlOrPath.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/?uploads\//, '');
  const candidate = path.join(__dirname, '../uploads', clean);
  if (fs.existsSync(candidate)) return candidate;

  // Check direct path inside uploads
  const candidate2 = path.join(__dirname, '../uploads', fileUrlOrPath.replace(/^\//, ''));
  if (fs.existsSync(candidate2)) return candidate2;

  return null;
}

/**
 * Helper: Stream local file with HTTP 206 Partial Content support
 */
function streamLocalFile(filePath, req, res, contentType = 'video/mp4', disposition = 'inline', filename = '') {
  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const headers = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    };

    if (disposition === 'attachment' && filename) {
      const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      headers['Content-Disposition'] = `attachment; filename="${cleanName}"`;
    } else {
      headers['Content-Disposition'] = 'inline';
    }

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).set({
          'Content-Range': `bytes */${fileSize}`,
          'Accept-Ranges': 'bytes',
        }).send('Requested range not satisfiable');
        return;
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize,
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        ...headers,
        'Content-Length': fileSize,
      });

      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('[Media Stream Local Error]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to stream media file' });
    }
  }
}

/**
 * Helper: Proxy external HTTP/HTTPS stream
 */
function proxyRemoteStream(targetUrl, req, res, defaultType = 'application/octet-stream', disposition = 'inline', filename = '') {
  try {
    const isHttps = targetUrl.startsWith('https:');
    const client = isHttps ? https : http;

    const options = {
      headers: { ...req.headers },
    };
    delete options.headers.host;

    client.get(targetUrl, options, (remoteRes) => {
      // If remote redirected, follow
      if (remoteRes.statusCode >= 300 && remoteRes.statusCode < 400 && remoteRes.headers.location) {
        return proxyRemoteStream(remoteRes.headers.location, req, res, defaultType, disposition, filename);
      }

      const headers = {
        'Content-Type': remoteRes.headers['content-type'] || defaultType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      };

      if (disposition === 'attachment' && filename) {
        const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        headers['Content-Disposition'] = `attachment; filename="${cleanName}"`;
      } else {
        headers['Content-Disposition'] = 'inline';
      }

      if (remoteRes.headers['content-range']) headers['Content-Range'] = remoteRes.headers['content-range'];
      if (remoteRes.headers['content-length']) headers['Content-Length'] = remoteRes.headers['content-length'];

      res.writeHead(remoteRes.statusCode, headers);
      remoteRes.pipe(res);
    }).on('error', (err) => {
      console.error('[Media Proxy Error]', err.message);
      if (!res.headersSent) {
        res.redirect(targetUrl);
      }
    });
  } catch (err) {
    console.error('[Media Proxy Exception]', err.message);
    if (!res.headersSent) {
      res.redirect(targetUrl);
    }
  }
}

/**
 * GET /api/media/video/:id/stream
 * Stream Video by ID with full HTTP 206 Partial Content support
 */
const streamVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const videoUrl = video.videoUrl || video.cloudinaryUrl || '';
    if (!videoUrl) {
      return res.status(404).json({ success: false, message: 'Video stream URL missing' });
    }

    const localPath = resolveLocalPath(videoUrl);
    if (localPath) {
      return streamLocalFile(localPath, req, res, 'video/mp4', 'inline');
    }

    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      return proxyRemoteStream(videoUrl, req, res, 'video/mp4', 'inline');
    }

    res.status(404).json({ success: false, message: 'Video media file not found' });
  } catch (err) {
    console.error('[Stream Video By ID Error]', err);
    res.status(500).json({ success: false, message: 'Failed to stream lecture video' });
  }
};

/**
 * GET /api/media/note/:id/view
 * View PDF Note inline
 */
const viewNotePdfById = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    const fileUrl = note.fileUrl || note.pdfUrl || '';
    if (!fileUrl) {
      return res.status(404).json({ success: false, message: 'PDF file URL missing' });
    }

    const localPath = resolveLocalPath(fileUrl);
    if (localPath) {
      return streamLocalFile(localPath, req, res, 'application/pdf', 'inline');
    }

    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return proxyRemoteStream(fileUrl, req, res, 'application/pdf', 'inline');
    }

    res.status(404).json({ success: false, message: 'PDF file not found' });
  } catch (err) {
    console.error('[View Note PDF Error]', err);
    res.status(500).json({ success: false, message: 'Failed to view PDF document' });
  }
};

/**
 * GET /api/media/note/:id/download
 * Force direct device download for PDF Note
 */
const downloadNotePdfById = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    const fileUrl = note.fileUrl || note.pdfUrl || '';
    if (!fileUrl) {
      return res.status(404).json({ success: false, message: 'PDF file URL missing' });
    }

    const rawName = req.query.filename || note.fileName || note.title || 'study-notes';
    const filename = rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`;

    const localPath = resolveLocalPath(fileUrl);
    if (localPath) {
      return streamLocalFile(localPath, req, res, 'application/pdf', 'attachment', filename);
    }

    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return proxyRemoteStream(fileUrl, req, res, 'application/pdf', 'attachment', filename);
    }

    res.status(404).json({ success: false, message: 'PDF file not found' });
  } catch (err) {
    console.error('[Download Note PDF Error]', err);
    res.status(500).json({ success: false, message: 'Failed to download PDF document' });
  }
};

/**
 * GET /api/media/book/:id/view
 */
const viewBookPdfById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

    const fileUrl = book.fileUrl || '';
    const localPath = resolveLocalPath(fileUrl);
    if (localPath) return streamLocalFile(localPath, req, res, 'application/pdf', 'inline');
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return proxyRemoteStream(fileUrl, req, res, 'application/pdf', 'inline');
    }
    res.status(404).json({ success: false, message: 'Book PDF not found' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to view book' });
  }
};

/**
 * GET /api/media/book/:id/download
 */
const downloadBookPdfById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

    const fileUrl = book.fileUrl || '';
    const rawName = req.query.filename || book.bookName || 'e-book';
    const filename = rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`;

    const localPath = resolveLocalPath(fileUrl);
    if (localPath) return streamLocalFile(localPath, req, res, 'application/pdf', 'attachment', filename);
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return proxyRemoteStream(fileUrl, req, res, 'application/pdf', 'attachment', filename);
    }
    res.status(404).json({ success: false, message: 'Book PDF not found' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to download book' });
  }
};

/**
 * GET /api/media/view-pdf?url=...
 * Universal query fallback
 */
const viewPdfByQuery = async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    url = decodeURIComponent(url).trim();
    const localPath = resolveLocalPath(url);
    if (localPath) return streamLocalFile(localPath, req, res, 'application/pdf', 'inline');

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return proxyRemoteStream(url, req, res, 'application/pdf', 'inline');
    }

    res.status(404).send('PDF file not found');
  } catch (err) {
    console.error('[View PDF Query Error]', err);
    res.status(500).send('Failed to stream PDF');
  }
};

/**
 * GET /api/media/download?url=...&filename=...
 * Universal query fallback
 */
const downloadByQuery = async (req, res) => {
  try {
    let { url, filename } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    url = decodeURIComponent(url).trim();
    const safeName = (filename || 'study-document').replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;

    const localPath = resolveLocalPath(url);
    if (localPath) return streamLocalFile(localPath, req, res, 'application/pdf', 'attachment', finalName);

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return proxyRemoteStream(url, req, res, 'application/pdf', 'attachment', finalName);
    }

    res.status(404).send('Download file not found');
  } catch (err) {
    console.error('[Download Query Error]', err);
    res.status(500).send('Failed to process download');
  }
};

/**
 * GET /api/media/stream?url=...
 * Universal video query fallback
 */
const streamByQuery = async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    url = decodeURIComponent(url).trim();
    const localPath = resolveLocalPath(url);
    if (localPath) return streamLocalFile(localPath, req, res, 'video/mp4', 'inline');

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return proxyRemoteStream(url, req, res, 'video/mp4', 'inline');
    }

    res.status(404).send('Video not found');
  } catch (err) {
    console.error('[Stream Query Error]', err);
    res.status(500).send('Failed to stream video');
  }
};

module.exports = {
  streamVideoById,
  viewNotePdfById,
  downloadNotePdfById,
  viewBookPdfById,
  downloadBookPdfById,
  viewPdfByQuery,
  downloadByQuery,
  streamByQuery,
};
