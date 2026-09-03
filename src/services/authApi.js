import { apiRequest } from './api';

export const authApi = {
  /**
   * Log in user (Admin, Teacher, or Student)
   */
  async login(email, password, role) {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });

    if (res.data && res.data.token) {
      localStorage.setItem('osp_token', res.data.token);
      localStorage.setItem('osp_user', JSON.stringify(res.data.user));
    }

    return res;
  },

  /**
   * Get current authenticated user profile
   */
  async getMe() {
    return await apiRequest('/auth/me');
  },

  /**
   * Log out user
   */
  logout() {
    localStorage.removeItem('osp_token');
    localStorage.removeItem('osp_user');
  },

  /**
   * Get cached user from localStorage
   */
  getCurrentUser() {
    try {
      const user = localStorage.getItem('osp_user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  /**
   * Check if user is logged in
   */
  isAuthenticated() {
    return !!localStorage.getItem('osp_token');
  },
};

export default authApi;
