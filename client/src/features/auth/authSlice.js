import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api'; // Use the configured axios instance

// Async thunk for user login
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/login', credentials);
      // Token is automatically handled by the axios interceptor (stores in localStorage)
      return response.data.user; // Return user data on success
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
      // Assuming the register endpoint also returns user data and sets token/header
      const response = await api.post('/api/register', credentials);
      // Token handling should be consistent with login (via interceptor)
      return response.data.user; // Return user data on success
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
    // No need to manually set header, axios interceptor does this
    try {
      const response = await api.get('/api/user/profile');
      return response.data.user;
    } catch (error) {
      // If token is invalid/expired, the API call will fail (e.g., 401/403)
      localStorage.removeItem('token'); // Clear invalid token
      const message =
        (error.response && error.response.data && (error.response.data.message || error.response.data)) ||
        error.message ||
        error.toString();
      return rejectWithValue(message);
    }
  }
);

// Simple action for logout (can be expanded if API call is needed)
export const logoutUser = createAsyncThunk(
    'auth/logoutUser',
    async (_, { dispatch }) => {
        localStorage.removeItem('token');
        // Optionally dispatch other actions if needed upon logout
        // e.g., dispatch(resetChatState());
        return null; // Indicate logout success
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
