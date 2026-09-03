// ============================================================
// ONLINE STUDY PLATFORM — LIVE API CLIENT BRIDGE
// ============================================================

const API_ROOT = window.API_ROOT || (
  typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes(':3000')
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api'
);

const LiveAPI = {
  baseUrl: API_ROOT,
  getToken() {
    return localStorage.getItem('osp_token') || '';
  },
  setToken(token) {
    localStorage.setItem('osp_token', token);
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('osp_user') || 'null');
    } catch {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem('osp_user', JSON.stringify(user));
  },
  clearAuth() {
    localStorage.removeItem('osp_token');
    localStorage.removeItem('osp_user');
    sessionStorage.removeItem('osp_active_teacher_id');
  },
  logout() {
    this.clearAuth();
    sessionStorage.clear();
    window.location.replace('index.html');
  },
  async getMe() {
    return await this.request('/auth/me');
  },
  async verifySession(requiredRole) {
    const token = this.getToken();
    if (!token) return { authenticated: false, reason: 'no_token' };

    let user = this.getUser();
    try {
      const res = await this.getMe();
      if (res && res.user) {
        user = res.user;
        this.setUser(user);
      }
    } catch (e) {
      if (e.message && (e.message.includes('401') || e.message.includes('expired') || e.message.includes('Unauthorized') || e.message.includes('jwt'))) {
        this.clearAuth();
        return { authenticated: false, reason: 'expired' };
      }
    }

    if (!user) return { authenticated: false, reason: 'no_user' };

    if (requiredRole) {
      const userRole = (user.role || '').toLowerCase();
      const roles = (user.roles || [userRole]).map(r => r.toLowerCase());
      const reqRole = requiredRole.toLowerCase();

      let isAllowed = false;
      if (reqRole === 'admin' && (userRole === 'admin' || userRole === 'super_admin' || roles.includes('admin') || roles.includes('super_admin'))) {
        isAllowed = true;
      } else if (reqRole === 'teacher' && (userRole === 'teacher' || roles.includes('teacher'))) {
        isAllowed = true;
      } else if (reqRole === 'student' && (userRole === 'student' || roles.includes('student'))) {
        isAllowed = true;
      }

      if (!isAllowed) {
        return { authenticated: true, authorized: false, user, reason: 'wrong_role' };
      }
    }

    return { authenticated: true, authorized: true, user };
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const url = `${API_ROOT}${endpoint}`;
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 && !endpoint.includes('/auth/login')) {
          console.warn('[LiveAPI] Session expired or unauthorized');
        }
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      console.warn(`[LiveAPI] Request to ${endpoint} failed:`, err.message);
      throw err;
    }
  },

  // Auth
  async login(email, password, role) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    const token = res.token || res.data?.token;
    const user = res.user || res.data?.user;
    if (token) {
      this.setToken(token);
      this.setUser(user);
    }
    return res;
  },

  async teacherLogin(email, password) {
    const res = await this.request('/auth/teacher/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const token = res.token || res.data?.token;
    const user = res.user || res.data?.user;
    if (token) {
      this.setToken(token);
      this.setUser(user);
    }
    return res;
  },

  async studentRegister(data) {
    const res = await this.request('/auth/student/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const token = res.token || res.data?.token;
    const user = res.user || res.data?.user;
    if (token) {
      this.setToken(token);
      this.setUser(user);
    }
    return res;
  },

  async studentLogin(email, password) {
    const res = await this.request('/auth/student/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const token = res.token || res.data?.token;
    const user = res.user || res.data?.user;
    if (token) {
      this.setToken(token);
      this.setUser(user);
    }
    return res;
  },

  async getMe() {
    return await this.request('/auth/me');
  },

  async getTeacherMe() {
    return await this.request('/teachers/me');
  },

  async getStudentMe() {
    return await this.request('/students/me');
  },

  async updateStudentMe(data) {
    return await this.request('/students/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getMyAllocations() {
    return await this.request('/teachers/me/allocations');
  },

  async getMyAssignedSubjects() {
    return await this.request('/teachers/my-subjects');
  },

  // Admin
  async getAdminStats() {
    return await this.request('/admins/stats');
  },
  async getTeachers() {
    return await this.request('/teachers');
  },
  async createTeacher(teacher) {
    const isForm = teacher instanceof FormData;
    return await this.request('/teachers', {
      method: 'POST',
      body: isForm ? teacher : JSON.stringify(teacher),
    });
  },
  async updateTeacher(id, updates) {
    const isForm = updates instanceof FormData;
    return await this.request(`/teachers/${id}`, {
      method: 'PUT',
      body: isForm ? updates : JSON.stringify(updates),
    });
  },
  async toggleTeacherStatus(id) {
    return await this.request(`/teachers/${id}/status`, { method: 'PATCH' });
  },
  async deleteTeacher(id) {
    return await this.request(`/teachers/${id}`, { method: 'DELETE' });
  },
  async getTeacherAllocations(teacherId) {
    return await this.request(`/teachers/${teacherId}/allocations`);
  },

  // Subjects
  async getSubjects() {
    return await this.request('/subjects');
  },
  async createSubject(subject) {
    return await this.request('/subjects', { method: 'POST', body: JSON.stringify(subject) });
  },
  async updateSubject(id, updates) {
    return await this.request(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
  },
  async deleteSubject(id) {
    return await this.request(`/subjects/${id}`, { method: 'DELETE' });
  },

  // User & Multi-Role Management
  async getUsers() {
    return await this.request('/users');
  },
  async assignTeacherRole(data) {
    const isForm = data instanceof FormData;
    return await this.request('/users/assign-teacher', {
      method: 'POST',
      body: isForm ? data : JSON.stringify(data),
    });
  },
  async makeAdmin(data) {
    return await this.request('/users/make-admin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async removeTeacherRole(email) {
    return await this.request('/users/remove-teacher', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async removeAdminRole(email) {
    return await this.request('/users/remove-admin', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Allocations
  async getAllocations() {
    return await this.request('/allocations');
  },
  async syncTeacherAllocations(teacherId, subjectIds) {
    return await this.request('/allocations/sync', {
      method: 'POST',
      body: JSON.stringify({ teacherId, subjectIds }),
    });
  },

  // Courses
  async getCourses() {
    return await this.request('/courses');
  },
  async getCourseById(id) {
    return await this.request(`/courses/${id}`);
  },
  async getCourseContent(id) {
    return await this.request(`/courses/${id}/content`);
  },

  // Progress
  async updateVideoProgress(data) {
    return await this.request('/progress/video', { method: 'POST', body: JSON.stringify(data) });
  },
  async getCourseProgress(courseId) {
    return await this.request(`/progress/${courseId}`);
  },

  // Modules
  async getModules(subjectId, courseId) {
    const query = courseId ? `?courseId=${courseId}` : subjectId ? `?subjectId=${subjectId}` : '';
    return await this.request(`/modules${query}`);
  },
  async createModule(data) {
    return await this.request('/modules', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateModule(id, data) {
    return await this.request(`/modules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteModule(id) {
    return await this.request(`/modules/${id}`, { method: 'DELETE' });
  },

  // Videos
  async createVideo(data) {
    const isForm = data instanceof FormData;
    return await this.request('/videos', { method: 'POST', body: isForm ? data : JSON.stringify(data) });
  },
  async deleteVideo(id) {
    return await this.request(`/videos/${id}`, { method: 'DELETE' });
  },
  // Comments
  async getVideoComments(videoId) {
    return await this.request(`/comments/video/${videoId}`);
  },
  async getTeacherStudentComments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/comments/teacher/my-comments${query ? `?${query}` : ''}`);
  },
  async createComment(data) {
    return await this.request('/comments', { method: 'POST', body: JSON.stringify(data) });
  },
  async addComment(data) {
    return await this.createComment(data);
  },
  async replyToComment(commentId, text) {
    return await this.request(`/comments/${commentId}/reply`, { method: 'POST', body: JSON.stringify({ text }) });
  },
  async deleteComment(id) {
    return await this.request(`/comments/${id}`, { method: 'DELETE' });
  },

  // Notes
  async createNote(data) {
    const isForm = data instanceof FormData;
    return await this.request('/notes', { method: 'POST', body: isForm ? data : JSON.stringify(data) });
  },
  async deleteNote(id) {
    return await this.request(`/notes/${id}`, { method: 'DELETE' });
  },

  // Quizzes & AI
  async createQuiz(data) {
    return await this.request('/quizzes', { method: 'POST', body: JSON.stringify(data) });
  },
  async generateAIQuiz(data) {
    return await this.request('/ai/generate-quiz', { method: 'POST', body: JSON.stringify(data) });
  },
  async askAIDoubt(data) {
    return await this.request('/ai/ask-doubt', { method: 'POST', body: JSON.stringify(data) });
  },
  async submitQuizAttempt(data) {
    return await this.request('/quiz-attempts', { method: 'POST', body: JSON.stringify(data) });
  },
  async getTeacherQuizResults() {
    return await this.request('/quiz-attempts/teacher/results');
  },

  // Enrollments
  async enrollCourse(courseId) {
    return await this.request('/enrollments', { method: 'POST', body: JSON.stringify({ courseId }) });
  },
  async getMyEnrolledCourses() {
    return await this.request('/enrollments/my-courses');
  },

  // Schedules
  async getSchedules() {
    return await this.request('/schedules');
  },
  async createSchedule(data) {
    return await this.request('/schedules', { method: 'POST', body: JSON.stringify(data) });
  },
  async deleteSchedule(id) {
    return await this.request(`/schedules/${id}`, { method: 'DELETE' });
  },

  // Announcements
  async getAnnouncements() {
    return await this.request('/announcements');
  },
  async createAnnouncement(data) {
    return await this.request('/announcements', { method: 'POST', body: JSON.stringify(data) });
  },
  async deleteAnnouncement(id) {
    return await this.request(`/announcements/${id}`, { method: 'DELETE' });
  },

  // E-Library Books
  async getBooks(category, search) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    const qs = params.toString();
    return await this.request(`/books${qs ? '?' + qs : ''}`);
  },
  async createBook(data) {
    const isForm = data instanceof FormData;
    return await this.request('/books', { method: 'POST', body: isForm ? data : JSON.stringify(data) });
  },
  async deleteBook(id) {
    return await this.request(`/books/${id}`, { method: 'DELETE' });
  },

  // Students & Progress
  async getStudents() {
    return await this.request('/students');
  },
  // Chat Rooms & Messages
  async getChatRoomMessages(room) {
    return await this.request(`/chat/rooms/${room}`);
  },
  async sendChatRoomMessage(room, message) {
    return await this.request(`/chat/rooms/${room}`, { method: 'POST', body: JSON.stringify({ message }) });
  },
  async deleteChatMessage(messageId) {
    return await this.request(`/chat/messages/${messageId}`, { method: 'DELETE' });
  },
  async getChatContacts() {
    return await this.request('/chat/contacts');
  },
  async getConversation(targetUserId) {
    return await this.request(`/chat/${targetUserId}`);
  },
  async sendMessage(data) {
    return await this.request('/chat', { method: 'POST', body: JSON.stringify(data) });
  },
};

window.LiveAPI = LiveAPI;
