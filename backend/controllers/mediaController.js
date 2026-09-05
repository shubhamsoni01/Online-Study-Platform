const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const mongoose = require('mongoose');
const Video = require('../models/Video');
const Note = require('../models/Note');
const Book = require('../models/Book');
const { findGridFSFile, openGridFSDownloadStream } = require('../services/storageService');
const { getAuthenticatedCloudinaryUrl } = require('../services/cloudinaryService');

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
 * Helper: Stream file directly from MongoDB Atlas GridFS with HTTP 206 Range Support
 */
async function streamGridFSFile(gridFileDoc, req, res, contentType = '', disposition = 'inline', filename = '') {
  try {
    const fileSize = gridFileDoc.length;
    const mimeType = contentType || gridFileDoc.contentType || (gridFileDoc.filename?.endsWith('.mp4') ? 'video/mp4' : gridFileDoc.filename?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    const range = req.headers.range;

    const headers = {
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    };

    const outFilename = filename || gridFileDoc.metadata?.originalName || gridFileDoc.filename || 'study_document';
    if (disposition === 'attachment') {
      const cleanName = outFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
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
      const downloadStream = openGridFSDownloadStream(gridFileDoc._id, {
        start: start,
        end: end + 1,
      });

      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize,
      });

      downloadStream.pipe(res);
    } else {
      res.writeHead(200, {
        ...headers,
        'Content-Length': fileSize,
      });

      const downloadStream = openGridFSDownloadStream(gridFileDoc._id);
      downloadStream.pipe(res);
    }
  } catch (err) {
    console.error('[Stream GridFS Error]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to stream file from cloud storage' });
    }
  }
}

/**
 * Helper: Proxy external HTTP/HTTPS stream (e.g. Cloudinary)
 */
function proxyRemoteStream(targetUrl, req, res, defaultType = 'application/octet-stream', disposition = 'inline', filename = '', onFailCallback = null) {
  try {
    const isHttps = targetUrl.startsWith('https:');
    const client = isHttps ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...req.headers,
      },
    };
    delete options.headers.host;

    const remoteReq = client.get(targetUrl, options, (remoteRes) => {
      // If remote redirected (301, 302, 307, 308), follow
      if (remoteRes.statusCode >= 300 && remoteRes.statusCode < 400 && remoteRes.headers.location) {
        let redirectUrl = remoteRes.headers.location;
        if (redirectUrl.startsWith('/')) {
          try {
            const origin = new URL(targetUrl).origin;
            redirectUrl = `${origin}${redirectUrl}`;
          } catch (e) {}
        }
        return proxyRemoteStream(redirectUrl, req, res, defaultType, disposition, filename, onFailCallback);
      }

      // If remote returned an error (4xx or 5xx)
      if (remoteRes.statusCode >= 400) {
        console.warn(`[Media Proxy Warning] Remote returned HTTP ${remoteRes.statusCode} (${remoteRes.headers['x-cld-error'] || 'Error'}) for URL: ${targetUrl}`);
        if (typeof onFailCallback === 'function') {
          return onFailCallback();
        }
        if (!res.headersSent) {
          res.status(remoteRes.statusCode).json({
            success: false,
            message: 'Unable to stream remote media resource',
            status: remoteRes.statusCode,
          });
        }
        return;
      }

      let finalContentType = defaultType;
      if (defaultType === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf'))) {
        finalContentType = 'application/pdf';
      } else if (defaultType === 'video/mp4' || (filename && filename.toLowerCase().endsWith('.mp4'))) {
        finalContentType = 'video/mp4';
      } else if (remoteRes.headers['content-type'] && remoteRes.headers['content-type'] !== 'application/octet-stream') {
        finalContentType = remoteRes.headers['content-type'];
      }

      const headers = {
        'Content-Type': finalContentType,
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
    });

    remoteReq.on('error', (err) => {
      console.error('[Media Proxy Error]', err.message);
      if (typeof onFailCallback === 'function') {
        return onFailCallback();
      }
      if (!res.headersSent) {
        res.status(502).json({ success: false, message: 'Failed to connect to media host' });
      }
    });
  } catch (err) {
    console.error('[Media Proxy Exception]', err.message);
    if (typeof onFailCallback === 'function') {
      return onFailCallback();
    }
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Media stream exception' });
    }
  }
}

/**
 * Helper: Universal Media Stream Resolver
 * Resolves by GridFS ID -> Local Path -> Cloudinary / Remote -> GridFS search by filename
 */
async function streamUniversalMedia(fileUrl, publicId, gridfsId, req, res, contentType, disposition, filename) {
  // 1. Check GridFS by gridfsId or publicId
  if (gridfsId || (publicId && /^[0-9a-fA-F]{24}$/.test(publicId))) {
    const gId = gridfsId || publicId;
    const gridFile = await findGridFSFile(gId);
    if (gridFile) {
      return streamGridFSFile(gridFile, req, res, contentType, disposition, filename);
    }
  }

  // 2. Check local disk cache
  if (fileUrl) {
    const localPath = resolveLocalPath(fileUrl);
    if (localPath) {
      return streamLocalFile(localPath, req, res, contentType, disposition, filename);
    }
  }

  // 3. Check Cloudinary or external URL
  if (fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
    if (fileUrl.includes('/api/media/file/')) {
      const fId = fileUrl.split('/api/media/file/')[1];
      const gridDoc = await findGridFSFile(fId);
      if (gridDoc) return streamGridFSFile(gridDoc, req, res, contentType, disposition, filename);
    }

    let targetStreamUrl = fileUrl;
    if (fileUrl.includes('cloudinary.com') || publicId) {
      const rType = (contentType === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf')))
        ? 'raw'
        : (contentType === 'video/mp4' ? 'video' : 'auto');
      targetStreamUrl = getAuthenticatedCloudinaryUrl(publicId, rType, fileUrl);
    }

    return proxyRemoteStream(targetStreamUrl, req, res, contentType, disposition, filename, async () => {
      // Fallback on remote failure: search GridFS
      if (gridfsId || publicId || fileUrl) {
        const gridDoc = await findGridFSFile(gridfsId || publicId || fileUrl);
        if (gridDoc) {
          return streamGridFSFile(gridDoc, req, res, contentType, disposition, filename);
        }
      }
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'Requested media resource is unavailable' });
      }
    });
  }

  // 4. Fallback search in GridFS by filename or clean url
  if (fileUrl || publicId) {
    const targetSearch = fileUrl || publicId;
    const gridDoc = await findGridFSFile(targetSearch);
    if (gridDoc) {
      return streamGridFSFile(gridDoc, req, res, contentType, disposition, filename);
    }
  }

  res.status(404).json({ success: false, message: 'Requested media resource could not be found' });
}

/**
 * GET /api/media/file/:id
 * Direct GridFS file stream endpoint
 */
const streamFileById = async (req, res) => {
  try {
    const fileId = req.params.id;
    const gridDoc = await findGridFSFile(fileId);
    if (!gridDoc) {
      return res.status(404).json({ success: false, message: 'File not found in persistent cloud storage' });
    }

    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    const filename = req.query.filename || gridDoc.metadata?.originalName || gridDoc.filename;
    return streamGridFSFile(gridDoc, req, res, gridDoc.contentType, disposition, filename);
  } catch (err) {
    console.error('[Stream File By ID Error]', err);
    res.status(500).json({ success: false, message: 'Failed to stream file from cloud storage' });
  }
};

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
    const publicId = video.cloudinaryPublicId || video.publicId || '';
    const gridfsId = video.gridfsId || '';
    const filename = video.title ? `${video.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.mp4` : 'lecture.mp4';

    return streamUniversalMedia(videoUrl, publicId, gridfsId, req, res, 'video/mp4', 'inline', filename);
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

    const fileUrl = note.fileUrl || note.pdfUrl || note.cloudinaryUrl || '';
    const publicId = note.cloudinaryPublicId || note.publicId || '';
    const gridfsId = note.gridfsId || '';
    const filename = (note.title || 'study-document').replace(/[^a-zA-Z0-9._-]/g, '_') + '.pdf';

    return streamUniversalMedia(fileUrl, publicId, gridfsId, req, res, 'application/pdf', 'inline', filename);
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

    const fileUrl = note.fileUrl || note.pdfUrl || note.cloudinaryUrl || '';
    const publicId = note.cloudinaryPublicId || note.publicId || '';
    const gridfsId = note.gridfsId || '';

    const rawName = req.query.filename || note.fileName || note.title || 'study-notes';
    const filename = rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`;

    return streamUniversalMedia(fileUrl, publicId, gridfsId, req, res, 'application/pdf', 'attachment', filename);
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

    const fileUrl = book.fileUrl || book.pdfUrl || '';
    const publicId = book.publicId || '';
    const gridfsId = book.gridfsId || '';
    const filename = (book.title || book.bookName || 'e-book').replace(/[^a-zA-Z0-9._-]/g, '_') + '.pdf';

    return streamUniversalMedia(fileUrl, publicId, gridfsId, req, res, 'application/pdf', 'inline', filename);
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

    const fileUrl = book.fileUrl || book.pdfUrl || '';
    const publicId = book.publicId || '';
    const gridfsId = book.gridfsId || '';

    const rawName = req.query.filename || book.bookName || book.title || 'e-book';
    const filename = rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`;

    return streamUniversalMedia(fileUrl, publicId, gridfsId, req, res, 'application/pdf', 'attachment', filename);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to download book' });
  }
};

/**
 * GET /api/media/view-pdf?url=...
 */
const viewPdfByQuery = async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) return res.status(400).json({ success: false, message: 'Missing url parameter' });

    url = decodeURIComponent(url).trim();
    return streamUniversalMedia(url, null, null, req, res, 'application/pdf', 'inline', 'document.pdf');
  } catch (err) {
    console.error('[View PDF Query Error]', err);
    res.status(500).json({ success: false, message: 'Failed to stream PDF' });
  }
};

/**
 * GET /api/media/download?url=...&filename=...
 */
const downloadByQuery = async (req, res) => {
  try {
    let { url, filename } = req.query;
    if (!url) return res.status(400).json({ success: false, message: 'Missing url parameter' });

    url = decodeURIComponent(url).trim();
    const safeName = (filename || 'study-document').replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;

    return streamUniversalMedia(url, null, null, req, res, 'application/pdf', 'attachment', finalName);
  } catch (err) {
    console.error('[Download Query Error]', err);
    res.status(500).json({ success: false, message: 'Failed to process download' });
  }
};

/**
 * GET /api/media/stream?url=...
 */
const streamByQuery = async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) return res.status(400).json({ success: false, message: 'Missing url parameter' });

    url = decodeURIComponent(url).trim();
    return streamUniversalMedia(url, null, null, req, res, 'video/mp4', 'inline', 'lecture.mp4');
  } catch (err) {
    console.error('[Stream Query Error]', err);
    res.status(500).json({ success: false, message: 'Failed to stream video' });
  }
};

module.exports = {
  streamFileById,
  streamVideoById,
  viewNotePdfById,
  downloadNotePdfById,
  viewBookPdfById,
  downloadBookPdfById,
  viewPdfByQuery,
  downloadByQuery,
  streamByQuery,
};
