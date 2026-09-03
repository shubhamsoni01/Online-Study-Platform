const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const userRoles = (req.user.roles || [userRole]).map(r => r.toLowerCase());

    const isAllowed = roles.some(role => {
      const r = role.toLowerCase();
      if (r === 'admin') {
        return userRole === 'admin' || userRole === 'super_admin' || userRoles.includes('admin') || userRoles.includes('super_admin');
      }
      return userRole === r || userRoles.includes(r);
    });

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Role [${userRole}] is not authorized for this resource. Required: [${roles.join(', ')}]`,
      });
    }

    next();
  };
};

const adminOnly = authorize('admin');
const teacherOnly = authorize('teacher');
const studentOnly = authorize('student');
const staffOnly = authorize('admin', 'teacher');
const anyUser = authorize('admin', 'teacher', 'student');

module.exports = {
  authorize,
  adminOnly,
  teacherOnly,
  studentOnly,
  staffOnly,
  anyUser,
};
