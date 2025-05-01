import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loadUser, logoutUser } from './features/auth/authSlice'; // Import Redux actions
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';

export default function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, user } = useSelector((state) => state.auth);
  const [showRegister, setShowRegister] = useState(false); // Keep local state for toggling form

  useEffect(() => {
    // Attempt to load user data on initial mount if token might exist
    dispatch(loadUser());
  }, [dispatch]);

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  // Show loading indicator while checking auth status
  if (isLoading && !isAuthenticated) {
     // Optional: Add a more sophisticated loading spinner/screen
     return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
  }

  // Render Login/Register or Dashboard based on Redux state
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        {showRegister ? (
          // Pass toggleForm, remove onAuth as it's handled by Redux now
          <Register toggleForm={() => setShowRegister(false)} />
        ) : (
          // Pass toggleForm, remove onAuth
          <Login toggleForm={() => setShowRegister(true)} />
        )}
      </div>
    );
  }

  // Render Dashboard, pass user and logout handler from Redux state/dispatch
  // Note: Dashboard could also use useSelector directly if preferred
  return <Dashboard user={user} onLogout={handleLogout} />;
}
