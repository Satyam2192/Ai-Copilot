import { Stack, SplashScreen } from "expo-router";
import { Provider } from 'react-redux';
import store from '../store'; // Correct path to your store
import { useFonts } from 'expo-font'; // If using custom fonts
import { useEffect } from 'react';
import "../global.css"

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Add font loading if needed
  const [fontsLoaded, fontError] = useFonts({
    // 'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'), // Example
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen after fonts have loaded or an error occurred
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Prevent rendering until fonts are loaded or error boundary catches the error
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Provider store={store}>
      <Stack>
        {/* Define screens here */}
        {/* The '(tabs)' layout defined in app/(tabs)/_layout.tsx will handle the main app interface */}
        {/* The 'index' screen will handle the auth check / initial routing */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* Add screen for Login */}
        <Stack.Screen name="Login" options={{ title: "Login", headerShown: false }} />
        {/* Add screen for Register */}
        <Stack.Screen name="Register" options={{ title: "Sign Up", headerShown: false }} />
         {/* Add screen for the main dashboard/chat interface */}
        <Stack.Screen name="Dashboard" options={{ headerShown: false }} />

        {/* You might have other stack screens, e.g., modals */}
        {/* <Stack.Screen name="+not-found" /> */}
      </Stack>
    </Provider>
  );
}
