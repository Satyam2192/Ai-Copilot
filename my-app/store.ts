import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/auth/authSlice'; // Adjust path if needed

export const store = configureStore({
  reducer: {
    auth: authReducer,
    // Add other reducers here if you create more slices
  },
  // Optional: Add middleware or devTools configuration if needed
  // RN Debugger integration often works out-of-the-box, but you might add specific middleware
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {auth: AuthState, ...}
export type AppDispatch = typeof store.dispatch;

export default store;
