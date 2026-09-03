const ChatMessage = require('../models/ChatMessage');
const Message = require('../models/Message');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Admin = require('../models/Admin');

/**
 * Get Messages for a Specific Chat Room ('common' | 'staff')
 * GET /api/chat/rooms/:room
 */
const getRoomMessages = async (req, res, next) => {
  try {
    const { room } = req.params;
    const user = req.user;

    if (!['common', 'staff'].includes(room)) {
      return res.status(400).json({ success: false, message: 'Invalid chat room. Must be "common" or "staff".' });
    }

    // Role-based room access check
    if (room === 'staff') {
      const allowedRoles = ['admin', 'super_admin', 'teacher'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Staff chat is restricted to Administrators and Teachers.',
        });
      }
    }

    const messages = await ChatMessage.find({
      room,
      deleted: false,
    })
      .sort({ createdAt: 1 })
      .limit(200);

    res.json({
      success: true,
      room,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send Message to a Specific Chat Room ('common' | 'staff')
 * POST /api/chat/rooms/:room
 * Body: { message }
 */
const sendRoomMessage = async (req, res, next) => {
  try {
    const { room } = req.params;
    const { message } = req.body;
    const user = req.user;

    if (!['common', 'staff'].includes(room)) {
      return res.status(400).json({ success: false, message: 'Invalid chat room. Must be "common" or "staff".' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    // Security check for staff chat
    if (room === 'staff') {
      const allowedRoles = ['admin', 'super_admin', 'teacher'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only Administrators and Teachers can participate in Staff Chat.',
        });
      }
    }

    // Check account status
    if (user.status === 'Inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. You cannot send messages.',
      });
    }

    const senderPhoto = user.photo || user.profilePhoto || '';

    const newChatMessage = await ChatMessage.create({
      room,
      senderId: user._id || user.id,
      senderName: user.name || 'User',
      senderRole: user.role,
      senderPhoto,
      message: message.trim(),
      deleted: false,
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newChatMessage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a Chat Message with Role-Based Permissions
 * DELETE /api/chat/messages/:id
 * Permissions:
 * - Admin/Super Admin: Can delete ANY message.
 * - Teacher: Can delete ANY message in common or staff chat.
 * - Student: Can delete ONLY their OWN message.
 */
const deleteRoomMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const chatMsg = await ChatMessage.findById(id);
    if (!chatMsg) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const userRole = user.role;
    const isOwner = chatMsg.senderId.toString() === (user._id || user.id).toString();

    // Permission Verification
    if (userRole === 'admin' || userRole === 'super_admin') {
      // Admin can delete any message
    } else if (userRole === 'teacher') {
      // Teacher can delete any message in common or staff room
    } else if (userRole === 'student') {
      // Student can ONLY delete their own message
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied: Students can only delete their own messages.',
        });
      }
    } else {
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied: You can only delete your own messages.',
        });
      }
    }

    // Mark as deleted or delete document
    await chatMsg.deleteOne();

    res.json({
      success: true,
      message: 'Message deleted successfully',
      data: { messageId: id, room: chatMsg.room },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Backward compatibility: Direct 1-on-1 conversations & Contacts
 */
const getConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { targetUserId } = req.params;

    if (targetUserId === 'common' || targetUserId === 'general') {
      return getRoomMessages({ ...req, params: { room: 'common' } }, res, next);
    }

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId },
      ],
    }).sort({ createdAt: 1 }).limit(100);

    await Message.updateMany(
      { senderId: targetUserId, receiverId: currentUserId, read: false },
      { read: true }
    );

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, receiverRole, message } = req.body;
    const sender = req.user;

    if (!receiverId || !message) {
      return res.status(400).json({ success: false, message: 'receiverId and message are required' });
    }

    if (receiverId === 'common' || receiverId === 'general') {
      return sendRoomMessage({ ...req, params: { room: 'common' } }, res, next);
    }

    const newMsg = await Message.create({
      senderId: sender._id,
      receiverId,
      senderRole: sender.role || 'user',
      receiverRole: receiverRole || 'user',
      senderName: sender.name,
      message: message.trim(),
      read: false,
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMsg,
    });
  } catch (error) {
    next(error);
  }
};

const getChatContacts = async (req, res, next) => {
  try {
    const role = req.user.role;
    const [teachers, students, admins] = await Promise.all([
      Teacher.find({ status: 'Active' }).select('name photo department email role'),
      Student.find({ status: 'Active' }).select('name photo department semester email rollNumber role'),
      Admin.find({ status: 'Active' }).select('name photo email role'),
    ]);

    let contacts = [];
    if (role === 'admin' || role === 'super_admin') {
      contacts = [
        ...teachers.map(t => ({ ...t.toObject(), contactRole: 'Teacher' })),
        ...students.map(s => ({ ...s.toObject(), contactRole: 'Student' })),
      ];
    } else if (role === 'teacher') {
      contacts = [
        ...admins.map(a => ({ ...a.toObject(), contactRole: 'Administrator' })),
        ...students.map(s => ({ ...s.toObject(), contactRole: 'Student' })),
      ];
    } else {
      contacts = [
        ...teachers.map(t => ({ ...t.toObject(), contactRole: 'Teacher' })),
        ...admins.map(a => ({ ...a.toObject(), contactRole: 'Administrator' })),
      ];
    }

    res.json({ success: true, data: contacts });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRoomMessages,
  sendRoomMessage,
  deleteRoomMessage,
  getConversation,
  sendMessage,
  getChatContacts,
};
