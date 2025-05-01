import axios from 'axios';

// Configure base URL and credentials
axios.defaults.baseURL = process.env.REACT_APP_API_URL;
axios.defaults.withCredentials = true;

// Add request interceptor for logging and auth
axios.interceptors.request.use(
  (config) => {
    const timestamp = new Date().toISOString();
    console.log(`[CLIENT] [API] [${timestamp}] Request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
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
    console.error('Error stack:', error.stack);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
axios.interceptors.response.use(
  (response) => {
    const timestamp = new Date().toISOString();
    console.log(`[CLIENT] [API] [${timestamp}] Response:`, {
      url: response.config.url,
      status: response.status,
      headers: response.headers,
      data: response.data
    });
    
    // Extract and store token from response headers if present
    const token = response.headers['x-auth-token'];
    if (token) {
      localStorage.setItem('token', token);
    }
    
    return response;
  },
  (error) => {
    const timestamp = new Date().toISOString();
    console.error(`[CLIENT] [API] [${timestamp}] Response Error:`, error.message);
    console.error('Error stack:', error.stack);
    return Promise.reject(error);
  }
);

export default axios;
