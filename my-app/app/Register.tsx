import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser, resetAuthError, selectAuthError, selectAuthIsLoading } from '../features/auth/authSlice'; // Adjust path
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router, Link } from 'expo-router'; // Use Link
import { AppDispatch, RootState } from '../store'; // Adjust path
// import { styled } from 'nativewind'; // Remove styled import

// Remove styled component definitions
// const StyledView = styled(View);
// const StyledText = styled(Text);
// const StyledTextInput = styled(TextInput);
// const StyledTouchableOpacity = styled(TouchableOpacity);

interface RegisterProps {}

export default function Register(props: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Optional: Add password confirmation state
  // const [confirmPassword, setConfirmPassword] = useState('');

  const dispatch = useDispatch<AppDispatch>();
  const isLoading = useSelector(selectAuthIsLoading);
  const error = useSelector(selectAuthError);

  useEffect(() => {
    dispatch(resetAuthError());
  }, [dispatch]);

  const handleRegister = () => {
     if (!email || !password) {
       Alert.alert("Error", "Please fill in all fields.");
       return;
     }
    // Optional: Add password confirmation check
    // if (password !== confirmPassword) {
    //   Alert.alert("Error", "Passwords do not match.");
    //   return;
    // }
    dispatch(registerUser({ email, password }));
    // Navigation handled by index.tsx based on auth state
  };

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center items-center bg-gray-900 p-4"
    >
      <View className="w-full max-w-sm bg-gray-800 rounded-lg shadow-md p-6">
        <Text className="text-2xl font-bold mb-6 text-center text-white">Sign Up</Text>

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
            placeholderTextColor="#9CA3AF"
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

        {/* Optional: Confirm Password Field */}
        {/* <View className="mb-6">
          <Text className="text-gray-300 text-sm font-bold mb-2">Confirm Password</Text>
          <TextInput
            className="shadow appearance-none border border-gray-600 rounded w-full py-3 px-4 text-white mb-3 leading-tight bg-gray-700 placeholder-gray-500 focus:border-blue-500"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm Password"
            secureTextEntry={true}
            editable={!isLoading}
            placeholderTextColor="#9CA3AF"
          />
        </View> */}

        <TouchableOpacity
          className={`py-3 px-4 rounded w-full items-center justify-center ${isLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-bold text-base">Sign Up</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-400">Already have an account? </Text>
          <Link href="/Login" asChild>
             <TouchableOpacity>
                 <Text className="text-yellow-500 font-bold hover:text-yellow-600">Log in</Text>
             </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
