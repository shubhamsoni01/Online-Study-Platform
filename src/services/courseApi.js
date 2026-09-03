import { apiRequest } from './api';

export const courseApi = {
  // Courses
  getCourses() {
    return apiRequest('/courses');
  },
  getCourseById(id) {
    return apiRequest(`/courses/${id}`);
  },
  createCourse(data) {
    return apiRequest('/courses', { method: 'POST', body: JSON.stringify(data) });
  },
  updateCourse(id, data) {
    return apiRequest(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteCourse(id) {
    return apiRequest(`/courses/${id}`, { method: 'DELETE' });
  },

  // Subjects
  getSubjects() {
    return apiRequest('/subjects');
  },
  getSubjectById(id) {
    return apiRequest(`/subjects/${id}`);
  },
  createSubject(data) {
    return apiRequest('/subjects', { method: 'POST', body: JSON.stringify(data) });
  },
  updateSubject(id, data) {
    return apiRequest(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteSubject(id) {
    return apiRequest(`/subjects/${id}`, { method: 'DELETE' });
  },

  // Modules
  getModules(query = {}) {
    const params = new URLSearchParams(query).toString();
    return apiRequest(`/modules${params ? '?' + params : ''}`);
  },
  createModule(data) {
    return apiRequest('/modules', { method: 'POST', body: JSON.stringify(data) });
  },
  updateModule(id, data) {
    return apiRequest(`/modules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteModule(id) {
    return apiRequest(`/modules/${id}`, { method: 'DELETE' });
  },
  reorderModules(moduleOrders) {
    return apiRequest('/modules/reorder', { method: 'POST', body: JSON.stringify({ moduleOrders }) });
  },

  // Videos
  getVideoById(id) {
    return apiRequest(`/videos/${id}`);
  },
  createVideo(data) {
    return apiRequest('/videos', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteVideo(id) {
    return apiRequest(`/videos/${id}`, { method: 'DELETE' });
  },

  // Notes
  getNoteById(id) {
    return apiRequest(`/notes/${id}`);
  },
  createNote(data) {
    return apiRequest('/notes', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteNote(id) {
    return apiRequest(`/notes/${id}`, { method: 'DELETE' });
  },

  // Video Comments
  getVideoComments(videoId) {
    return apiRequest(`/comments/video/${videoId}`);
  },
  addComment(data) {
    return apiRequest('/comments', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteComment(id) {
    return apiRequest(`/comments/${id}`, { method: 'DELETE' });
  },

  // Announcements
  getAnnouncements() {
    return apiRequest('/announcements');
  },
  createAnnouncement(data) {
    return apiRequest('/announcements', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteAnnouncement(id) {
    return apiRequest(`/announcements/${id}`, { method: 'DELETE' });
  },

  // Books / E-Library
  getBooks(query = {}) {
    const params = new URLSearchParams(query).toString();
    return apiRequest(`/books${params ? '?' + params : ''}`);
  },
  createBook(data) {
    return apiRequest('/books', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteBook(id) {
    return apiRequest(`/books/${id}`, { method: 'DELETE' });
  },

  // Schedules
  getSchedules() {
    return apiRequest('/schedules');
  },
  createSchedule(data) {
    return apiRequest('/schedules', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteSchedule(id) {
    return apiRequest(`/schedules/${id}`, { method: 'DELETE' });
  },

  // Chat
  getChatContacts() {
    return apiRequest('/chat/contacts');
  },
  getConversation(targetUserId) {
    return apiRequest(`/chat/${targetUserId}`);
  },
  sendMessage(data) {
    return apiRequest('/chat', { method: 'POST', body: JSON.stringify(data) });
  },
};

export default courseApi;
