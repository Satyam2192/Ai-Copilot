import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, resetAuthError, authSelectors } from '../features/auth/authSlice'; // Adjust path
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router, Link } from 'expo-router';
import { AppDispatch, RootState } from '../store';


interface LoginProps {}

interface LoginCredentials {
  email: string;
  password: string;
}

export default function Login(props: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch<AppDispatch>();
  const isLoading = useSelector(authSelectors.selectAuthIsLoading);
  const error = useSelector(authSelectors.selectAuthError);
  const isAuthenticated = useSelector(authSelectors.selectIsAuthenticated); // Get isAuthenticated state

  useEffect(() => {
    // Clear error when the component mounts
    dispatch(resetAuthError());
  }, [dispatch]);

  useEffect(() => {
    // Log auth state change for debugging
    console.log('[LOGIN] isAuthenticated state changed:', isAuthenticated);
    // If authenticated, navigate directly from here.
    if (isAuthenticated) {
      console.log('[LOGIN] Authenticated, navigating to Dashboard...');
      router.replace('/Dashboard');
    }
  }, [isAuthenticated]);


  const handleLogin = () => {
    // Basic validation
    if (!email || !password) {
       // Optionally show a local error message
       alert("Please enter both email and password.");
       return;
    }
    dispatch(loginUser({ email, password }));
    // Navigation is handled by the index.tsx redirecting based on isAuthenticated state change
  };

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center items-center bg-gray-900 p-4"
    >
        <View className="w-full max-w-sm bg-gray-800 rounded-lg shadow-md p-6">
            <Text className="text-2xl font-bold mb-6 text-center text-white">Login</Text>

            {error && <Text className="text-red-500 text-center mb-4">{error}</Text>}

            <View className="mb-4">
                <Text className="text-gray-300 text-sm font-bold mb-2">Email Address</Text>
                <TextInput
                    className="shadow appearance-none border border-gray-600 rounded w-full py-3 px-4 text-white leading-tight bg-gray-700 placeholder-gray-500 focus:border-blue-500"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email address"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading}
                    placeholderTextColor="#9CA3AF" // Explicit placeholder color for RN
                />
            </View>

            <View className="mb-6">
                <Text className="text-gray-300 text-sm font-bold mb-2">Password</Text>
                <TextInput
                    className="shadow appearance-none border border-gray-600 rounded w-full py-3 px-4 text-white mb-3 leading-tight bg-gray-700 placeholder-gray-500 focus:border-blue-500"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    secureTextEntry={true}
                    editable={!isLoading}
                    placeholderTextColor="#9CA3AF"
                />
            </View>

            <TouchableOpacity
                className={`py-3 px-4 rounded w-full items-center justify-center ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`} // Note: hover: classes might not work directly
                onPress={handleLogin}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color="#ffffff" />
                ) : (
                    <Text className="text-white font-bold text-base">Log in</Text>
                )}
            </TouchableOpacity>

            <View className="flex-row justify-center mt-6">
                <Text className="text-gray-400">Don't have an account? </Text>
                {/* Use Link component for navigation */}
                 <Link href="/Register" asChild>
                     <TouchableOpacity>
                         <Text className="text-yellow-500 font-bold hover:text-yellow-600">Sign up</Text>
                    </TouchableOpacity>
                 </Link>
            </View>
        </View>
    </KeyboardAvoidingView>
  );
}
