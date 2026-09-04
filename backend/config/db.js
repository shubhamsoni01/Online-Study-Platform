const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

let isConnected = false;
let lastDbError = null;

function sanitizeMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') return rawUri;
  let str = rawUri.trim();
  str = str.replace(/^(MONGODB_URI|MONGO_URI)\s*=\s*/i, '');
  str = str.replace(/^["']|["']$/g, '').trim();

  const prefix = str.startsWith('mongodb+srv://') ? 'mongodb+srv://' : str.startsWith('mongodb://') ? 'mongodb://' : '';
  if (!prefix) return str;

  try {
    const rest = str.slice(prefix.length);
    const lastAtIndex = rest.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const creds = rest.substring(0, lastAtIndex);
      const hostAndParams = rest.substring(lastAtIndex + 1);
      const firstColon = creds.indexOf(':');
      if (firstColon !== -1) {
        const username = creds.substring(0, firstColon);
        let password = creds.substring(firstColon + 1);
        // Replace unencoded @ with %40
        if (password.includes('@') && !password.includes('%40')) {
          password = password.replace(/@/g, '%40');
        }
        return `${prefix}${username}:${password}@${hostAndParams}`;
      }
    }
  } catch (e) {}
  return str;
}

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/OnlineStudyPlatform';
  const uri = sanitizeMongoUri(rawUri);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    console.log(`MongoDB connected successfully. Database: ${conn.connection.name}`);

    // Auto-ensure Super Admin exists on cloud database
    try {
      const User = require('../models/User');
      const Admin = require('../models/Admin');
      const bcrypt = require('bcryptjs');

      const adminEmail = (process.env.ADMIN_EMAIL || 'kumarshubham3187@gmail.com').toLowerCase().trim();
      const adminPass = process.env.ADMIN_PASSWORD || '822115';

      let adminUser = await User.findOne({ email: adminEmail });
      let adminDoc = await Admin.findOne({ email: adminEmail });

      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(adminPass, salt);

      if (!adminUser) {
        await User.create({
          name: 'Shubham Kumar',
          email: adminEmail,
          roles: ['super_admin', 'admin', 'teacher', 'student'],
          password: hashed,
          adminPassword: hashed,
          teacherPassword: hashed,
          studentPassword: hashed,
          status: 'Active',
        });
        console.log(`[Auto-Seed] Super Admin User initialized: ${adminEmail}`);
      }

      if (!adminDoc) {
        await Admin.create({
          name: 'Shubham Kumar',
          email: adminEmail,
          password: hashed,
          role: 'super_admin',
          status: 'Active',
        });
        console.log(`[Auto-Seed] Super Admin Doc initialized: ${adminEmail}`);
      }
    } catch (seedErr) {
      console.warn(`[Auto-Seed Notice] ${seedErr.message}`);
    }
  } catch (error) {
    lastDbError = error.message;
    console.error(`MongoDB connection error: ${error.message}`);
    console.warn(`[DB Notice] Server running in fallback mode while database reconnects.`);
  }
};

module.exports = connectDB;
module.exports.getLastError = () => lastDbError;
