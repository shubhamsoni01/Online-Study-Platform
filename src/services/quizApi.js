import { apiRequest } from './api';

export const quizApi = {
  getQuizById(id) {
    return apiRequest(`/quizzes/${id}`);
  },
  createQuiz(data) {
    return apiRequest('/quizzes', { method: 'POST', body: JSON.stringify(data) });
  },
  updateQuiz(id, data) {
    return apiRequest(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteQuiz(id) {
    return apiRequest(`/quizzes/${id}`, { method: 'DELETE' });
  },
  generateAIQuiz(data) {
    return apiRequest('/ai/generate-quiz', { method: 'POST', body: JSON.stringify(data) });
  },
  submitQuizAttempt(data) {
    return apiRequest('/quiz-attempts', { method: 'POST', body: JSON.stringify(data) });
  },
  getMyAttempts(query = {}) {
    const params = new URLSearchParams(query).toString();
    return apiRequest(`/quiz-attempts/my-attempts${params ? '?' + params : ''}`);
  },
  getAttemptById(id) {
    return apiRequest(`/quiz-attempts/${id}`);
  },
};

export default quizApi;
