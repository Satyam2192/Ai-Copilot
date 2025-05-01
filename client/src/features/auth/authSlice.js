import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
// Import specific API functions - removed apiLogout
import { login, register, checkAuth } from '../../services/api'; 

// Async thunk for user login
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      // Use the imported login function
      const response = await login(credentials); 
      // Token is automatically handled by the axios interceptor
      // Ensure the login API returns { user: ..., token: ... } or similar
      return response.data.user; 
    } catch (error) {
      const message =
        (error.response && error.response.data && (error.response.data.message || error.response.data)) ||
        error.message ||
        error.toString();
      return rejectWithValue(message);
    }
  }
);

// Async thunk for user registration
export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (credentials, { rejectWithValue }) => {
    try {
      // Use the imported register function
      const response = await register(credentials);
      // Token handling via interceptor
      // Ensure the register API returns { user: ..., token: ... } or similar
      return response.data.user; 
    } catch (error) {
      const message =
        (error.response && error.response.data && (error.response.data.message || error.response.data)) ||
        error.message ||
        error.toString();
      return rejectWithValue(message);
    }
  }
);

// Async thunk to load user data if a token exists (e.g., on app load/refresh)
export const loadUser = createAsyncThunk(
  'auth/loadUser',
  async (_, { rejectWithValue, getState }) => {
    // Check if token exists in localStorage (or could check state if preferred)
    const token = localStorage.getItem('token');
    if (!token) {
      return rejectWithValue('No token found');
    }
    // Interceptor handles the token header
    try {
      // Use the imported checkAuth function (ensure endpoint matches in api.js)
      const response = await checkAuth(); 
      // Ensure the checkAuth API returns { user: ... }
      return response.data.user; 
    } catch (error) {
      // If token is invalid/expired, the API call will fail
      localStorage.removeItem('token'); // Clear invalid token
      const message =
        (error.response && error.response.data && (error.response.data.message || error.response.data)) ||
        error.message ||
        error.toString();
      return rejectWithValue(message);
    }
  }
);

// Async thunk for logout, calling the API endpoint
export const logoutUser = createAsyncThunk(
    'auth/logoutUser',
    async (_, { rejectWithValue }) => {
        try {
            // Removed await apiLogout(); as there's no backend endpoint/API function
            localStorage.removeItem('token');
            return null; // Indicate logout success
        } catch (error) {
             // This catch block might be less relevant now without the API call,
             // but we'll keep the token removal for safety.
             localStorage.removeItem('token'); // Still clear token even if API fails
             const message =
                (error.response && error.response.data && (error.response.data.message || error.response.data)) ||
                error.message ||
                error.toString();
             console.error('Logout API call failed:', message);
             // Decide if this should be a hard failure or just log
             // return rejectWithValue(message); 
             return null; // Proceed with client-side logout anyway
        }
    }
);


const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  token: localStorage.getItem('token'), // Initialize token from localStorage
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Optional: Reducers for synchronous actions if needed
    resetAuthError: (state) => {
        state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login User
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        state.token = localStorage.getItem('token'); // Ensure token state is synced
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload;
        localStorage.removeItem('token'); // Clear token on failed login
      })
      // Register User (similar handling to login)
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        state.token = localStorage.getItem('token'); // Ensure token state is synced
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload;
        localStorage.removeItem('token'); // Clear token on failed registration
      })
      // Load User
      .addCase(loadUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        state.token = localStorage.getItem('token'); // Ensure token state is synced
      })
      .addCase(loadUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        // Keep error message if needed: state.error = action.payload;
        // No need to remove token here, loadUser logic already does on API fail
      })
      // Logout User
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
        state.token = null;
        // localStorage is cleared within the thunk
      });
  },
});

export const { resetAuthError } = authSlice.actions;
export default authSlice.reducer;
