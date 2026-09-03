import { apiRequest } from './api';

export const uploadApi = {
  /**
   * Upload file to Cloudinary via backend
   * @param {File} file
   * @param {string} folder - e.g. 'study_platform/videos'
   * @param {string} resourceType - 'auto' | 'video' | 'raw' | 'image'
   */
  async uploadFile(file, folder = 'study_platform', resourceType = 'auto') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('resourceType', resourceType);

    return await apiRequest('/upload', {
      method: 'POST',
      body: formData,
    });
  },
};

export default uploadApi;
