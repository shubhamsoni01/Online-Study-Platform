import { apiRequest } from './api';

export const studentApi = {
  getStudents() {
    return apiRequest('/students');
  },
  getStudentById(id) {
    return apiRequest(`/students/${id}`);
  },
  createStudent(data) {
    return apiRequest('/students', { method: 'POST', body: JSON.stringify(data) });
  },
  updateStudent(id, data) {
    return apiRequest(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteStudent(id) {
    return apiRequest(`/students/${id}`, { method: 'DELETE' });
  },
  getMyEnrolledCourses() {
    return apiRequest('/enrollments/my-courses');
  },
  enrollInCourse(courseId) {
    return apiRequest('/enrollments', { method: 'POST', body: JSON.stringify({ courseId }) });
  },
  checkEnrollment(courseId) {
    return apiRequest(`/enrollments/check/${courseId}`);
  },
  getCourseProgress(courseId) {
    return apiRequest(`/progress/${courseId}`);
  },
  updateProgress(data) {
    return apiRequest('/progress', { method: 'POST', body: JSON.stringify(data) });
  },
};

export default studentApi;
