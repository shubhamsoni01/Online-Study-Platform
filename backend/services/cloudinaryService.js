const { Readable } = require('stream');
const path = require('path');
const cloudinary = require('../config/cloudinary');

/**
 * Check whether valid Cloudinary credentials are configured
 */
const hasValidCloudinary = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_API_KEY !== '123456789012345' &&
    process.env.CLOUDINARY_API_SECRET !== 'studyplatform_secret_key_mock'
  );
};

/**
 * Upload file buffer directly to Cloudinary (Primary & Required Persistent Storage)
 * Zero local/ephemeral disk fallback to ensure 100% permanence across Render restarts.
 *
 * @param {Buffer} buffer - File buffer from Multer memoryStorage
 * @param {String} folder - Cloudinary folder name (e.g. 'videos', 'notes', 'photos', 'elibrary')
 * @param {String} resourceType - 'auto' | 'video' | 'raw' | 'image'
 * @param {String} originalName - Original filename for extension preservation
 * @returns {Promise<{ secureUrl: string, publicId: string, duration?: string, fileSize?: string, format?: string, resourceType: string, bytes: number }>}
 */
const uploadToCloudinary = async (buffer, folder = 'uploads', resourceType = 'auto', originalName = '') => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('File missing or invalid buffer provided for upload');
  }

  // 1. Strict Cloudinary Credential Enforcement (No ephemeral local disk writes)
  if (!hasValidCloudinary()) {
    throw new Error(
      'Cloudinary persistent cloud storage is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your Render environment variables to store media permanently.'
    );
  }

  // 2. Max File Size Validation (100 MB max)
  if (buffer.length > 100 * 1024 * 1024) {
    throw new Error('File size exceeds the maximum allowed limit of 100 MB.');
  }

  // 3. Folder Sanitization
  const cleanFolder = folder.replace(/^study_platform\/?/, '') || 'uploads';
  const targetFolder = `study_platform/${cleanFolder}`;

  // For raw documents / PDFs, preserve extension in public_id
  let options = {
    folder: targetFolder,
    resource_type: resourceType,
    chunk_size: 6000000,
    timeout: 300000,
  };

  if (resourceType === 'raw' && originalName) {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    options.use_filename = true;
    options.unique_filename = true;
    options.filename_override = `${baseName}_${Date.now()}${ext}`;
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(options, (error, res) => {
        if (error) return reject(error);
        resolve(res);
      });

      Readable.from(buffer).pipe(uploadStream);
    });

    return {
      secureUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      duration: result.duration ? `${Math.floor(result.duration / 60)}:${Math.floor(result.duration % 60).toString().padStart(2, '0')}` : undefined,
      fileSize: result.bytes ? `${(result.bytes / (1024 * 1024)).toFixed(2)} MB` : `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
      resourceType: result.resource_type || resourceType,
      originalName: originalName || result.original_filename,
      bytes: result.bytes || buffer.length,
    };
  } catch (err) {
    console.error(`[Cloudinary Upload Failure] ${err.message}`);
    throw new Error(`Failed to upload media to Cloudinary cloud storage: ${err.message}`);
  }
};

/**
 * Delete resource from Cloudinary
 * @param {String} publicId - Cloudinary Public ID
 * @param {String} resourceType - 'image' | 'video' | 'raw'
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return { result: 'ok' };

  if (!hasValidCloudinary()) {
    console.warn('[Cloudinary Warning] Cannot delete resource: Cloudinary credentials not configured.');
    return { result: 'skipped' };
  }

  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error(`[Cloudinary Delete Error] ${error.message}`);
    return null;
  }
};

module.exports = {
  hasValidCloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
};
