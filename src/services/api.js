// ============================================================
// BASE API CLIENT FOR ONLINE STUDY PLATFORM
// ============================================================

const API_BASE_URL = window.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Perform an authenticated HTTP request to backend
 * @param {string} endpoint - e.g. '/courses' or '/auth/login'
 * @param {object} options - method, body, headers, etc.
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('osp_token');
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  // Attach token if present
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set JSON content-type if not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/login')) {
        // Token expired or invalid
        localStorage.removeItem('osp_token');
        localStorage.removeItem('osp_user');
      }
      const error = new Error(data.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    console.error(`[API Request Error] ${endpoint}:`, err);
    throw err;
  }
}

export default apiRequest;
