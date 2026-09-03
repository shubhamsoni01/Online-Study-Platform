import { apiRequest } from './api';

export const adminApi = {
  getDashboardStats() {
    return apiRequest('/admins/stats');
  },
  getAdmins() {
    return apiRequest('/admins');
  },
  createAdmin(data) {
    return apiRequest('/admins', { method: 'POST', body: JSON.stringify(data) });
  },
  updateAdmin(id, data) {
    return apiRequest(`/admins/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteAdmin(id) {
    return apiRequest(`/admins/${id}`, { method: 'DELETE' });
  },
  getEnrollmentAnalysis() {
    return apiRequest('/admins/enrollment-analysis');
  },
};

export default adminApi;
