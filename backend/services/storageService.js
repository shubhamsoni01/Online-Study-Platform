const mongoose = require('mongoose');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');

let gridfsBucket = null;

/**
 * Initialize or get MongoDB GridFS bucket
 */
function getGridFSBucket() {
  if (!gridfsBucket && mongoose.connection.readyState === 1) {
    gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads_bucket',
    });
  }
  return gridfsBucket;
}

/**
 * Upload buffer to MongoDB Atlas GridFS
 * @param {Buffer} buffer - File buffer
 * @param {String} filename - File name
 * @param {String} mimeType - MIME type
 * @param {Object} metadata - Custom metadata
 * @returns {Promise<{ fileId: string, url: string, filename: string, size: number, mimeType: string }>}
 */
const uploadToGridFS = async (buffer, filename, mimeType, metadata = {}) => {
  const bucket = getGridFSBucket();
  if (!bucket) {
    throw new Error('Database connection not ready for GridFS upload');
  }

  const cleanFilename = filename || `file_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(cleanFilename, {
      contentType: mimeType || 'application/octet-stream',
      metadata: {
        ...metadata,
        uploadedAt: new Date(),
        sizeBytes: buffer.length,
      },
    });

    uploadStream.on('error', (err) => {
      reject(err);
    });

    uploadStream.on('finish', () => {
      resolve({
        fileId: uploadStream.id.toString(),
        url: `/api/media/file/${uploadStream.id}`,
        filename: cleanFilename,
        size: buffer.length,
        mimeType: mimeType,
        storageProvider: 'gridfs',
      });
    });

    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
  });
};

/**
 * Upload to persistent cloud storage (Cloudinary if configured, otherwise MongoDB Atlas GridFS)
 * @param {Buffer} buffer - Raw file buffer from Multer
 * @param {String} folder - Subfolder name ('videos', 'notes', 'photos', 'books')
 * @param {String} resourceType - 'auto' | 'video' | 'raw' | 'image'
 * @param {String} originalName - Original filename for extension preservation
 * @returns {Promise<{ secureUrl: string, publicId: string, duration?: string, fileSize?: string, storageProvider: string, gridfsId?: string }>}
 */
const uploadFile = async (buffer, folder = 'uploads', resourceType = 'auto', originalName = '') => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('File missing or invalid buffer provided');
  }

  const cleanFolder = folder.replace(/^study_platform\/?/, '') || 'uploads';
  const ext = originalName ? path.extname(originalName) : resourceType === 'video' ? '.mp4' : resourceType === 'image' ? '.jpg' : '.pdf';
  const fileId = `file_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const filename = `${fileId}${ext}`;
  const mimeType = resourceType === 'video' ? 'video/mp4' : resourceType === 'image' ? (ext === '.png' ? 'image/png' : 'image/jpeg') : 'application/pdf';

  // 1. Try Cloudinary if real credentials exist
  const hasValidCloudinary =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_API_KEY !== '123456789012345' &&
    process.env.CLOUDINARY_API_SECRET !== 'studyplatform_secret_key_mock';

  if (hasValidCloudinary) {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `study_platform/${cleanFolder}`,
            resource_type: resourceType,
            chunk_size: 6000000,
            timeout: 300000,
          },
          (error, res) => {
            if (error) return reject(error);
            resolve(res);
          }
        );
        Readable.from(buffer).pipe(uploadStream);
      });

      return {
        secureUrl: result.secure_url,
        publicId: result.public_id,
        duration: result.duration ? `${Math.floor(result.duration / 60)}:${Math.floor(result.duration % 60).toString().padStart(2, '0')}` : undefined,
        fileSize: result.bytes ? `${(result.bytes / (1024 * 1024)).toFixed(2)} MB` : `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
        resourceType: result.resource_type || resourceType,
        storageProvider: 'cloudinary',
        mimeType: mimeType,
      };
    } catch (cErr) {
      console.warn(`[StorageService] Cloudinary upload rejected (${cErr.message}). Storing permanently in MongoDB Atlas GridFS...`);
    }
  }

  // 2. Persistent Storage Engine: MongoDB Atlas GridFS (Survives Render Restarts & Redeploys)
  try {
    const gridRes = await uploadToGridFS(buffer, filename, mimeType, {
      folder: cleanFolder,
      originalName: originalName || filename,
      resourceType: resourceType,
    });

    // Also write to local cache if possible for faster local streaming
    try {
      const targetDir = path.join(__dirname, '../uploads', cleanFolder);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, filename), buffer);
    } catch (e) {}

    return {
      secureUrl: gridRes.url,
      publicId: gridRes.fileId,
      gridfsId: gridRes.fileId,
      duration: resourceType === 'video' ? '15:00' : undefined,
      fileSize: `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
      resourceType: resourceType,
      storageProvider: 'gridfs',
      mimeType: mimeType,
    };
  } catch (gridErr) {
    console.error(`[StorageService] GridFS Upload Error: ${gridErr.message}`);
    throw gridErr;
  }
};

/**
 * Delete a file from GridFS or Cloudinary
 */
const deleteFile = async (publicIdOrGridfsId, resourceType = 'image') => {
  if (!publicIdOrGridfsId) return { result: 'ok' };

  // Try GridFS deletion if 24-hex ObjectId
  if (/^[0-9a-fA-F]{24}$/.test(publicIdOrGridfsId)) {
    try {
      const bucket = getGridFSBucket();
      if (bucket) {
        await bucket.delete(new mongoose.Types.ObjectId(publicIdOrGridfsId));
        return { result: 'ok' };
      }
    } catch (e) {}
  }

  // Try Cloudinary
  try {
    return await cloudinary.uploader.destroy(publicIdOrGridfsId, { resource_type: resourceType });
  } catch (error) {
    return null;
  }
};

/**
 * Find GridFS file metadata by ID or Filename
 */
const findGridFSFile = async (identifier) => {
  const bucket = getGridFSBucket();
  if (!bucket) return null;

  const db = mongoose.connection.db;
  const filesColl = db.collection('uploads_bucket.files');

  if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
    const file = await filesColl.findOne({ _id: new mongoose.Types.ObjectId(identifier) });
    if (file) return file;
  }

  // Search by filename
  const fileByName = await filesColl.findOne({ filename: identifier });
  if (fileByName) return fileByName;

  // Search by regex filename or originalName
  const cleanName = identifier.replace(/^\/?uploads\/[^\/]+\//, '').replace(/^\//, '');
  return await filesColl.findOne({
    $or: [
      { filename: cleanName },
      { 'metadata.originalName': cleanName },
    ],
  });
};

/**
 * Open a readable stream from GridFS for a given file ObjectId or file doc
 */
const openGridFSDownloadStream = (fileIdOrDoc, options = {}) => {
  const bucket = getGridFSBucket();
  if (!bucket) throw new Error('GridFS Bucket not ready');

  const id = (typeof fileIdOrDoc === 'object' && fileIdOrDoc._id) ? fileIdOrDoc._id : new mongoose.Types.ObjectId(fileIdOrDoc);
  return bucket.openDownloadStream(id, options);
};

module.exports = {
  getGridFSBucket,
  uploadFile,
  uploadToGridFS,
  deleteFile,
  findGridFSFile,
  openGridFSDownloadStream,
};
