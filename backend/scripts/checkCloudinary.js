require('dotenv').config({ path: 'd:\\Desktop\\study platform\\backend\\.env' });
const cloudinary = require('cloudinary').v2;

const cn = process.env.CLOUDINARY_CLOUD_NAME || '';
const key = process.env.CLOUDINARY_API_KEY || '';
const sec = process.env.CLOUDINARY_API_SECRET || '';

console.log('Cloud name length:', cn.length, 'trimmed:', cn.trim().length);
console.log('Key length:', key.length, 'trimmed:', key.trim().length);
console.log('Secret length:', sec.length, 'trimmed:', sec.trim().length);

cloudinary.config({
  cloud_name: cn.trim(),
  api_key: key.trim(),
  api_secret: sec.trim(),
});

// Test upload of 1x1 png image directly to Cloudinary
const testPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

cloudinary.uploader.upload_stream(
  { folder: 'test_diagnosis', resource_type: 'image' },
  (error, result) => {
    if (error) {
      console.log('CLOUDINARY DIRECT UPLOAD RESULT: FAIL');
      console.log('ERROR MESSAGE:', error.message);
      console.log('HTTP CODE:', error.http_code);
    } else {
      console.log('CLOUDINARY DIRECT UPLOAD RESULT: PASS');
      console.log('URL:', result.secure_url);
    }
  }
).end(testPngBuffer);
