const cloudinary = require('cloudinary').v2;

// Support both individual environment variables and CLOUDINARY_URL connection string
if (process.env.CLOUDINARY_URL && (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY)) {
  try {
    const parsed = new URL(process.env.CLOUDINARY_URL);
    process.env.CLOUDINARY_CLOUD_NAME = parsed.hostname;
    process.env.CLOUDINARY_API_KEY = parsed.username;
    process.env.CLOUDINARY_API_SECRET = parsed.password;
  } catch (e) {}
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

module.exports = cloudinary;

