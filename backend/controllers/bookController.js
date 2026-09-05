const Book = require('../models/Book');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');

/**
 * Get All E-Library Books (with search and category filter)
 * GET /api/books?search=...&category=...
 */
const getBooks = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const filter = { status: 'Active' };

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { bookName: { $regex: q, $options: 'i' } },
        { author: { $regex: q, $options: 'i' } },
        { subjectName: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const books = await Book.find(filter)
      .populate('uploadedBy', 'name photo department')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: books });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload/Create E-Library Book (Teacher only)
 * POST /api/books
 */
const createBook = async (req, res, next) => {
  try {
    const { bookName, author, subjectName, subjectId, description, category, fileUrl } = req.body;
    const uploadedBy = req.user._id;

    if (!bookName || !author) {
      return res.status(400).json({ success: false, message: 'Book name and author are required' });
    }

    let finalUrl = fileUrl;
    let finalPublicId = '';
    let finalGridfsId = '';
    let finalStorageProvider = 'external';
    let originalName = req.file?.originalname || `${bookName}.pdf`;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'study_platform/elibrary', 'raw', req.file.originalname);
      finalUrl = uploadResult.secureUrl;
      finalPublicId = uploadResult.publicId;
      finalStorageProvider = 'cloudinary';

      // Optional GridFS backup for book PDF
      try {
        const { uploadToGridFS } = require('../services/storageService');
        const gridRes = await uploadToGridFS(req.file.buffer, originalName, 'application/pdf', {
          originalName: req.file.originalname,
          publicId: finalPublicId,
          bookName: bookName.trim(),
        });
        if (gridRes && gridRes.fileId) {
          finalGridfsId = gridRes.fileId;
        }
      } catch (gErr) {
        console.warn('[Book Upload] GridFS backup skipped:', gErr.message);
      }
    }

    if (!finalUrl) {
      return res.status(400).json({ success: false, message: 'Please select a PDF file to upload' });
    }

    const book = await Book.create({
      bookName: bookName.trim(),
      author: author.trim(),
      subjectName: subjectName ? subjectName.trim() : 'General',
      subjectId: subjectId || null,
      description: description ? description.trim() : '',
      category: category || 'Other',
      fileUrl: finalUrl,
      publicId: finalPublicId,
      gridfsId: finalGridfsId,
      storageProvider: finalStorageProvider,
      originalName,
      mimeType: 'application/pdf',
      uploadedBy,
      status: 'Active',
    });

    res.status(201).json({
      success: true,
      message: 'Book uploaded to E-Library successfully',
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Book (Teacher uploader only)
 * DELETE /api/books/:id
 */
const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    if (book.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only delete your own uploaded books' });
    }

    if (book.publicId) {
      await deleteFromCloudinary(book.publicId, 'raw');
    }

    await book.deleteOne();
    res.json({ success: true, message: 'Book removed from E-Library' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBooks,
  createBook,
  deleteBook,
};
