import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../store'; // Import RootState
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login, register, checkAuth } from '../../services/api'; // Adjust path if needed

// Define the shape of the user object if possible (helps with TypeScript)
interface User {
  id: string; // Or number, depending on your backend
  email: string;
  // Add other user properties
}

// Define the shape of the auth state
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null; // Store token in state for potential synchronous access if needed
}

// Async thunk for user login
export const loginUser = createAsyncThunk<User, { email: string; password: string }, { rejectValue: string }>(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await login(credentials);
      // Assume interceptor handles storing the token in AsyncStorage
      // Ensure API returns the user object
      if (!response.data || !response.data.user) {
         return rejectWithValue('Login successful, but user data was not returned.');
      }
      return response.data.user as User; // Assert type
    } catch (error: any) { // Catch block type safety
      const message =
        error.response?.data?.message || error.response?.data?.error || error.message || 'Login failed';
      await AsyncStorage.removeItem('token'); // Ensure token is cleared on login failure
      return rejectWithValue(message);
    }
  }
);

// Async thunk for user registration
export const registerUser = createAsyncThunk<User, { email: string; password: string }, { rejectValue: string }>(
  'auth/registerUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await register(credentials);
       // Assume interceptor handles storing the token in AsyncStorage
      if (!response.data || !response.data.user) {
         return rejectWithValue('Registration successful, but user data was not returned.');
      }
      return response.data.user as User;
    } catch (error: any) {
      const message =
         error.response?.data?.message || error.response?.data?.error || error.message || 'Registration failed';
      await AsyncStorage.removeItem('token'); // Ensure token is cleared
      return rejectWithValue(message);
    }
  }
);

// Async thunk to load user data if a token exists
export const loadUser = createAsyncThunk(
  'auth/loadUser',
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        return rejectWithValue('No token found');
      }
      // Interceptor adds token to header for checkAuth
      const response = await checkAuth();
      if (!response.data || !response.data.user) {
         // Token might be valid but API didn't return user? Clear token.
         await AsyncStorage.removeItem('token');
         return rejectWithValue('Authentication check failed: User data missing.');
      }
      return response.data.user; // as User;
    } catch (error: any) {
      await AsyncStorage.removeItem('token'); // Clear invalid/expired token
      const message =
        error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to load user';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for logout
export const logoutUser = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      // Optional: Call a backend logout endpoint if you have one to invalidate the token server-side
      // await apiClient.post('/api/logout');
      await AsyncStorage.removeItem('token');
      return; // Indicate success
    } catch (error: any) {
      // Even if backend call fails, attempt to clear local token
      await AsyncStorage.removeItem('token');
      const message =
        error.response?.data?.message || error.response?.data?.error || error.message || 'Logout failed';
      console.error('Logout error:', message);
      // Decide if this should fail the operation or just log
      // return rejectWithValue(message);
      return; // Proceed with client-side logout anyway
    }
  }
);

// Define the initial state using the AuthState interface
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false, // Start as false, set true during initial loadUser attempt
  error: null,
  token: null, // Will be loaded asynchronously
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthError: (state: AuthState) => {
      state.error = null;
    },
    // Optional: Synchronously update token state if needed elsewhere
    // setToken: (state, action: PayloadAction<string | null>) => {
    //   state.token = action.payload;
    // }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state: AuthState) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state: AuthState, action: PayloadAction<User>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state: AuthState, action: PayloadAction<string | undefined>) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload || 'Login failed';
      })
      .addCase(registerUser.pending, (state: AuthState) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state: AuthState, action: PayloadAction<User>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state: AuthState, action: PayloadAction<string | undefined>) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload || 'Registration failed';
      })
      .addCase(loadUser.pending, (state: AuthState) => {
        state.isLoading = true;
        state.error = null;
        console.log('[authSlice] loadUser.pending');
      })
      .addCase(loadUser.fulfilled, (state: AuthState, action: PayloadAction<User>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        state.error = null;
        console.log('[authSlice] loadUser.fulfilled - isAuthenticated:', state.isAuthenticated, 'user:', state.user ? 'present' : 'null');
      })
      .addCase(loadUser.rejected, (state: AuthState, action: PayloadAction<string | undefined>) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload || 'Failed to load user';
        console.error('[authSlice] loadUser.rejected - error:', state.error);
      })
      .addCase(logoutUser.pending, (state: AuthState) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state: AuthState) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
        state.token = null;
      })
      .addCase(logoutUser.rejected, (state: AuthState, action) => { // Correct type inferred from thunk
        // Still log out client-side even if API fails
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.token = null;
        // Optionally set an error message if needed
        // action.payload will be the rejectValue (string) if rejected with value, otherwise action.error will contain SerializedError
        state.error = action.payload || action.error?.message || "Logout failed, but you have been logged out locally.";
        console.error("Logout rejected:", action.payload || action.error?.message);
      });
  },
});

export const { resetAuthError } = authSlice.actions;
export default authSlice.reducer;

// Selectors (optional but good practice)
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectUser = (state: RootState) => state.auth.user;
export const selectAuthIsLoading = (state: RootState) => state.auth.isLoading;
export const selectAuthError = (state: RootState) => state.auth.error;
