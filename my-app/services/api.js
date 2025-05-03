import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants'; // Import Constants

// Get API URL from extras
const apiURL = Constants.expoConfig?.extra?.API_URL || 'https://default.fallback.url'; // Provide a fallback

// Configure base URL and credentials
const apiClient = axios.create({
  //baseURL: process.env.REACT_APP_API_URL || '', // Remove this line
  baseURL: apiURL, // Use the URL from Constants
  withCredentials: true, // Note: Cookie-based auth can be tricky in RN. Token-based (Authorization header) is more common.
});

// Add request interceptor for logging and auth
apiClient.interceptors.request.use(
  async (config) => {
    const timestamp = new Date().toISOString();
    console.log(`[CLIENT] [API] [${timestamp}] Request:`, {
      url: config.url,
      method: config.method,
      data: config.data
    });

    // Add auth token from AsyncStorage if available
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    } else {
       // Ensure Authorization header isn't set if no token exists
       delete config.headers['Authorization'];
    }

    return config;
  },
  (error) => {
    const timestamp = new Date().toISOString();
    console.error(`[CLIENT] [API] [${timestamp}] Request Error:`, error); // Log the full error
    return Promise.reject(error);
  }
);

// Add response interceptor for logging and token handling
apiClient.interceptors.response.use(
  async (response) => {
    const timestamp = new Date().toISOString();
    console.log(`[CLIENT] [API] [${timestamp}] Response:`, {
      url: response.config.url,
      status: response.status,
    });

    // Extract and store token from response headers if present
    const tokenHeader = response.headers['x-auth-token']; // Case-insensitive check might be needed depending on server
    if (tokenHeader) {
      await AsyncStorage.setItem('token', tokenHeader);
      console.log('[CLIENT] [API] Token updated from response header.');
    }

    // Also handle token if sent in the response body
    if (response.data && response.data.token) {
        await AsyncStorage.setItem('token', response.data.token);
        console.log('[CLIENT] [API] Token updated from response body.');
    }

    return response;
  },
  async (error) => {
    const timestamp = new Date().toISOString();
    const status = error.response?.status;
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    console.error(`[CLIENT] [API] [${timestamp}] Response Error:`, status ? `${status} - ${errorMessage}` : errorMessage, error.response?.data);

    // Handle specific error statuses like 401 Unauthorized
    if (status === 401) {
        console.warn('[CLIENT] [API] Unauthorized access detected. Clearing token.');
        await AsyncStorage.removeItem('token');
        // In Expo Router, navigation is typically handled differently than window.location
        // You might dispatch a logout action or use router.replace('/login'); from a component
    }

    return Promise.reject(error);
  }
);

// --- API Call Functions ---
// (Keep the exported functions as they are)
// Auth
export const login = (credentials) => apiClient.post('/api/login', credentials);
export const register = (userData) => apiClient.post('/api/register', userData);
export const checkAuth = () => apiClient.get('/api/user/profile');

// Sessions
export const startSession = (data) => apiClient.post('/api/sessions', data);
export const listSessions = (params) => apiClient.get('/api/sessions', { params });
export const getSession = (id) => apiClient.get(`/api/sessions/${id}`);
export const updateSession = (id, data) => apiClient.patch(`/api/sessions/${id}`, data);
export const endSession = (id, data) => apiClient.post(`/api/sessions/${id}/end`, data);
export const deleteSession = (id) => apiClient.delete(`/api/sessions/${id}`);
export const updateSessionFeedback = (id, feedbackData) => apiClient.post(`/api/sessions/${id}/feedback`, feedbackData);

// Chat
export const sendMessage = (messageData) => apiClient.post('/api/chat', messageData);

// Questions
export const getQuestions = (params) => apiClient.get('/api/questions', { params });
export const getQuestionById = (id) => apiClient.get(`/api/questions/${id}`);

export default apiClient; // Exporting default might not be needed if only named exports are used
