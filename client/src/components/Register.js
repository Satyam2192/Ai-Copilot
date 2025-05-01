import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser, resetAuthError } from '../features/auth/authSlice'; // Import Redux actions

// Remove onAuth from props
export default function Register({ toggleForm }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth); // Get state from Redux

  // Clear error when component mounts or toggleForm changes
  useEffect(() => {
    dispatch(resetAuthError());
  }, [dispatch, toggleForm]);

  const submit = (e) => {
    e.preventDefault();
    dispatch(resetAuthError()); // Clear previous errors
    dispatch(registerUser({ email, password })); // Dispatch register action
    // Redux state change will handle UI update via App.js
  };

  return (
    <form onSubmit={submit} className="w-full p-4 sm:p-6 sm:max-w-sm sm:mx-auto bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-white">Sign Up</h2>
      {/* Display error from Redux state */}
      {error && <p className="text-red-500 text-center mb-4">{typeof error === 'string' ? error : 'Registration failed'}</p>}
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="email">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 text-white placeholder-gray-500"
          required
          disabled={isLoading} // Disable input while loading
        />
      </div>
      <div className="mb-6">
        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="password">
          Password
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 text-white placeholder-gray-500"
          required
          disabled={isLoading} // Disable input while loading
        />
      </div>
      <div className="flex items-center justify-between">
        <button
          type="submit"
          className={`bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isLoading} // Disable button while loading
        >
          {isLoading ? 'Signing up...' : 'Sign Up'}
        </button>
      </div>
      <div className="text-center mt-4">
        <p className="text-gray-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={toggleForm}
            className="text-yellow-500 hover:text-yellow-600 font-bold focus:outline-none"
          >
            Log in
          </button>
        </p>
      </div>
    </form>
  );
}
