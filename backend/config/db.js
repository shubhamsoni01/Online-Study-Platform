const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/OnlineStudyPlatform';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
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
    console.error(`MongoDB connection error: ${error.message}`);
    console.warn(`[DB Notice] Server running in fallback mode while database reconnects.`);
  }
};

module.exports = connectDB;
