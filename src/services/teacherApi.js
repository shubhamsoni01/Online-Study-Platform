import { apiRequest } from './api';

export const teacherApi = {
  getTeachers() {
    return apiRequest('/teachers');
  },
  getTeacherById(id) {
    return apiRequest(`/teachers/${id}`);
  },
  createTeacher(data) {
    return apiRequest('/teachers', { method: 'POST', body: JSON.stringify(data) });
  },
  updateTeacher(id, data) {
    return apiRequest(`/teachers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  toggleStatus(id) {
    return apiRequest(`/teachers/${id}/status`, { method: 'PATCH' });
  },
  deleteTeacher(id) {
    return apiRequest(`/teachers/${id}`, { method: 'DELETE' });
  },
  getTeacherDashboardStats() {
    return apiRequest('/teachers/dashboard/my-stats');
  },
  getMyAssignedSubjects() {
    return apiRequest('/teachers/my-subjects');
  },
  syncAllocations(teacherId, subjectIds) {
    return apiRequest('/allocations/sync', {
      method: 'POST',
      body: JSON.stringify({ teacherId, subjectIds }),
    });
  },
};

export default teacherApi;
