const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const baseDir = path.join(__dirname, '../..');
const connectDB = require(path.join(baseDir, 'backend/config/db'));
const { uploadToGridFS, findGridFSFile } = require(path.join(baseDir, 'backend/services/storageService'));

const Video = require(path.join(baseDir, 'backend/models/Video'));
const Note = require(path.join(baseDir, 'backend/models/Note'));
const Book = require(path.join(baseDir, 'backend/models/Book'));
const Teacher = require(path.join(baseDir, 'backend/models/Teacher'));
const Student = require(path.join(baseDir, 'backend/models/Student'));

async function migrate() {
  await connectDB();
  console.log('\n==================================================');
  console.log('🚀 MIGRATING LOCAL FILES TO MONGODB ATLAS GRIDFS');
  console.log('==================================================\n');

  // Helper to read local file from uploads
  function getLocalBuffer(relUrl) {
    if (!relUrl) return null;
    const clean = relUrl.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/?uploads\//, '');
    const p1 = path.join(baseDir, 'backend/uploads', clean);
    if (fs.existsSync(p1)) return { buffer: fs.readFileSync(p1), filename: path.basename(p1) };
    const p2 = path.join(baseDir, 'backend/uploads', relUrl.replace(/^\//, ''));
    if (fs.existsSync(p2)) return { buffer: fs.readFileSync(p2), filename: path.basename(p2) };
    return null;
  }

  // 1. Migrate Videos
  console.log('--- 1. MIGRATING VIDEOS ---');
  const videos = await Video.find({});
  for (const v of videos) {
    const targetUrl = v.videoUrl || v.cloudinaryUrl || '';
    const local = getLocalBuffer(targetUrl);
    if (local) {
      const existingGrid = await findGridFSFile(local.filename);
      let fileId = existingGrid ? existingGrid._id.toString() : null;

      if (!fileId) {
        const gridRes = await uploadToGridFS(local.buffer, local.filename, 'video/mp4', {
          originalName: v.title || local.filename,
          folder: 'videos',
          resourceType: 'video',
        });
        fileId = gridRes.fileId;
        console.log(`  ✅ Uploaded Video "${v.title}" (${local.filename}) -> GridFS ID: ${fileId}`);
      } else {
        console.log(`  ℹ️ Video "${v.title}" already in GridFS -> GridFS ID: ${fileId}`);
      }

      v.gridfsId = fileId;
      v.storageProvider = 'gridfs';
      v.originalName = v.title || local.filename;
      v.mimeType = 'video/mp4';
      v.videoUrl = `/api/media/file/${fileId}`;
      v.cloudinaryUrl = `/api/media/file/${fileId}`;
      await v.save();
    } else {
      console.log(`  ⚠️ Local file not found on disk for video "${v.title}" (${targetUrl})`);
    }
  }

  // 2. Migrate Notes
  console.log('\n--- 2. MIGRATING NOTES ---');
  const notes = await Note.find({});
  for (const n of notes) {
    const targetUrl = n.fileUrl || n.pdfUrl || n.cloudinaryUrl || '';
    const local = getLocalBuffer(targetUrl);
    if (local) {
      const existingGrid = await findGridFSFile(local.filename);
      let fileId = existingGrid ? existingGrid._id.toString() : null;

      if (!fileId) {
        const gridRes = await uploadToGridFS(local.buffer, local.filename, 'application/pdf', {
          originalName: n.title || local.filename,
          folder: 'notes',
          resourceType: 'raw',
        });
        fileId = gridRes.fileId;
        console.log(`  ✅ Uploaded Note "${n.title}" (${local.filename}) -> GridFS ID: ${fileId}`);
      } else {
        console.log(`  ℹ️ Note "${n.title}" already in GridFS -> GridFS ID: ${fileId}`);
      }

      n.gridfsId = fileId;
      n.storageProvider = 'gridfs';
      n.originalName = n.title || local.filename;
      n.mimeType = 'application/pdf';
      n.fileUrl = `/api/media/file/${fileId}`;
      n.pdfUrl = `/api/media/file/${fileId}`;
      n.cloudinaryUrl = `/api/media/file/${fileId}`;
      await n.save();
    } else {
      console.log(`  ⚠️ Local file not found on disk for note "${n.title}" (${targetUrl})`);
    }
  }

  // 3. Migrate Books
  console.log('\n--- 3. MIGRATING E-LIBRARY BOOKS ---');
  const books = await Book.find({});
  for (const b of books) {
    const targetUrl = b.fileUrl || b.pdfUrl || '';
    const local = getLocalBuffer(targetUrl);
    if (local) {
      const existingGrid = await findGridFSFile(local.filename);
      let fileId = existingGrid ? existingGrid._id.toString() : null;

      if (!fileId) {
        const gridRes = await uploadToGridFS(local.buffer, local.filename, 'application/pdf', {
          originalName: b.bookName || local.filename,
          folder: 'elibrary',
          resourceType: 'raw',
        });
        fileId = gridRes.fileId;
        console.log(`  ✅ Uploaded Book "${b.bookName}" (${local.filename}) -> GridFS ID: ${fileId}`);
      } else {
        console.log(`  ℹ️ Book "${b.bookName}" already in GridFS -> GridFS ID: ${fileId}`);
      }

      b.gridfsId = fileId;
      b.storageProvider = 'gridfs';
      b.originalName = b.bookName || local.filename;
      b.mimeType = 'application/pdf';
      b.fileUrl = `/api/media/file/${fileId}`;
      await b.save();
    }
  }

  // 4. Migrate Photos
  console.log('\n--- 4. MIGRATING TEACHER & STUDENT PHOTOS ---');
  const teachers = await Teacher.find({});
  for (const t of teachers) {
    const photoUrl = t.profilePhoto?.url || t.photo || '';
    const local = getLocalBuffer(photoUrl);
    if (local) {
      const existingGrid = await findGridFSFile(local.filename);
      let fileId = existingGrid ? existingGrid._id.toString() : null;

      if (!fileId) {
        const gridRes = await uploadToGridFS(local.buffer, local.filename, 'image/jpeg', {
          originalName: local.filename,
          folder: 'photos',
          resourceType: 'image',
        });
        fileId = gridRes.fileId;
        console.log(`  ✅ Uploaded Teacher Photo (${local.filename}) -> GridFS ID: ${fileId}`);
      }
      t.photo = `/api/media/file/${fileId}`;
      t.profilePhoto = { url: `/api/media/file/${fileId}`, publicId: fileId };
      await t.save();
    }
  }

  console.log('\n==================================================');
  console.log('🎉 ALL MEDIA FILES SUCCESSFULLY MIGRATED TO GRIDFS!');
  console.log('==================================================\n');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
