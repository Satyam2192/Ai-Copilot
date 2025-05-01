import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/auth/authSlice'; // Import the auth reducer

export const store = configureStore({
  reducer: {
    auth: authReducer, // Add the auth reducer to the store
  },
  // Optional: Add middleware or devTools configuration if needed
});

export default store;
