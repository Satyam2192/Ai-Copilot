import axios from 'axios';

// Configure base URL and credentials
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '', // Use server root or relative path
  withCredentials: true,
});

// Add request interceptor for logging and auth
apiClient.interceptors.request.use(
  (config) => {
    const timestamp = new Date().toISOString();
    console.log(`[CLIENT] [API] [${timestamp}] Request:`, {
      url: config.url,
      method: config.method,
      // Avoid logging sensitive headers like Authorization in production
      // headers: config.headers, 
      data: config.data
    });

    // Add auth token from localStorage if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    const timestamp = new Date().toISOString();
    console.error(`[CLIENT] [API] [${timestamp}] Request Error:`, error.message);
    // console.error('Error stack:', error.stack); // Maybe too verbose for production
    return Promise.reject(error);
  }
);

// Add response interceptor for logging and token handling
apiClient.interceptors.response.use(
  (response) => {
    const timestamp = new Date().toISOString();
    console.log(`[CLIENT] [API] [${timestamp}] Response:`, {
      url: response.config.url,
      status: response.status,
      // data: response.data // Can be large, log selectively if needed
    });

    // Extract and store token from response headers if present (adjust header name if needed)
    const token = response.headers['x-auth-token']; 
    if (token) {
      localStorage.setItem('token', token);
      console.log('[CLIENT] [API] Token updated from response header.');
    }
    
    // Also handle token if sent in the response body (e.g., during login)
    if (response.data && response.data.token) {
        localStorage.setItem('token', response.data.token);
        console.log('[CLIENT] [API] Token updated from response body.');
    }


    return response;
  },
  (error) => {
    const timestamp = new Date().toISOString();
    console.error(`[CLIENT] [API] [${timestamp}] Response Error:`, error.response ? `${error.response.status} - ${error.response.data?.error || error.message}` : error.message);
    // console.error('Error stack:', error.stack); // Maybe too verbose for production

    // Handle specific error statuses like 401 Unauthorized (e.g., redirect to login)
    if (error.response && error.response.status === 401) {
        console.warn('[CLIENT] [API] Unauthorized access detected. Clearing token and potentially redirecting.');
        localStorage.removeItem('token');
        // Optionally redirect: window.location.href = '/login'; 
    }

    return Promise.reject(error);
  }
);

// --- API Call Functions ---

// Auth (Mounted under /api)
export const login = (credentials) => apiClient.post('/api/login', credentials);
export const register = (userData) => apiClient.post('/api/register', userData);
export const checkAuth = () => apiClient.get('/api/user/profile');
// Note: No explicit logout API call needed if using token invalidation client-side

// Sessions (Mounted under /api/sessions)
export const startSession = (data) => apiClient.post('/api/sessions', data);
export const listSessions = (params) => apiClient.get('/api/sessions', { params });
export const getSession = (id) => apiClient.get(`/api/sessions/${id}`);
export const updateSession = (id, data) => apiClient.patch(`/api/sessions/${id}`, data);
export const endSession = (id, data) => apiClient.post(`/api/sessions/${id}/end`, data);
export const deleteSession = (id) => apiClient.delete(`/api/sessions/${id}`); // Needs backend route
export const updateSessionFeedback = (id, feedbackData) => apiClient.post(`/api/sessions/${id}/feedback`, feedbackData);

// Chat (Mounted under /api/chat)
// chatController expects sessionId in the body, not the URL path
export const sendMessage = (messageData) => apiClient.post('/api/chat', messageData);

// Common Chat (Mounted under /api/common-chat)
export const getGlobalChat = () => apiClient.get('/api/common-chat/global');
export const joinGlobalChat = () => apiClient.post('/api/common-chat/global/join');
export const leaveGlobalChat = () => apiClient.post('/api/common-chat/global/leave');
export const sendGlobalChatMessage = (content) => apiClient.post('/api/common-chat/global/message', { content });
export const clearGlobalChatAPI = () => apiClient.post('/api/common-chat/global/clear');

// Questions (Mounted under /api/questions)
export const getQuestions = (params) => apiClient.get('/api/questions', { params });
export const getQuestionById = (id) => apiClient.get(`/api/questions/${id}`);

// Export the configured apiClient if direct access is needed elsewhere, though using specific functions is preferred.
// export default apiClient;
