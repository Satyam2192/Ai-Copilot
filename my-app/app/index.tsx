import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Redirect, router } from 'expo-router'; // Keep router for programmatic navigation
import { loadUser, selectIsAuthenticated, selectAuthIsLoading } from '../features/auth/authSlice'; // Adjust path
import { AppDispatch, RootState } from '../store'; // Adjust path

export default function Index() {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectAuthIsLoading); // Use dedicated loading selector

  useEffect(() => {
    // Attempt to load user data when the app starts or this screen mounts
    dispatch(loadUser());
  }, [dispatch]);

  useEffect(() => {
    // Log auth state change for debugging
    console.log('[INDEX] Auth state changed - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);
    // If authenticated and not loading, navigate to the main dashboard
    if (!isLoading && isAuthenticated) {
      console.log('[INDEX] Authenticated, navigating to Dashboard');
      router.replace('/Dashboard');
    }
  }, [isLoading, isAuthenticated]);

  // Show loading indicator while checking auth state
  if (isLoading) {
    console.log('[INDEX] Showing loading indicator');
    return (
      <View className="flex-1 justify-center items-center bg-gray-900">
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // If authenticated, return null or a loading indicator while navigation happens in useEffect
  // The useEffect above handles the navigation, so we don't need Redirect here
  if (isAuthenticated) {
     console.log('[INDEX] Authenticated, returning null (navigation handled by effect)');
     return null;
  }

  // If not authenticated and not loading, redirect to the Login screen
  // Ensure you have a screen defined at '/Login'
  console.log('[INDEX] Not authenticated, redirecting to Login');
  return <Redirect href="/Login" />;

  // Note: The previous Login/Register toggle logic is removed from here.
  // Login.tsx and Register.tsx will handle toggling between themselves.
}
