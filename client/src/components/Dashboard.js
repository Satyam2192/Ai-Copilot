import React from 'react';
import Chat from './Chat';
import api from '../services/api';

export default function Dashboard({ user, onLogout }) {
  const handleLogout = async () => {
    try {
      await api.post('/api/logout'); // Assuming a logout endpoint exists
      onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
      // Optionally display an error message
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-gray-800 shadow-md">
        <h1 className="text-xl font-bold">Interview Co-Pilot</h1>
        <div className="flex items-center">
          <span className="mr-4 text-gray-300">{user.email}</span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded focus:outline-none focus:shadow-outline"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-grow overflow-hidden">
        {/* Conversation Area */}
        <div className="flex-grow p-4 overflow-y-auto">
          <Chat user={user} />
        </div>

        {/* Sidebar */}
        <aside className="w-80 bg-gray-800 p-4 flex-shrink-0 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Interview Co-Pilot</h2>
          <div className="bg-yellow-600 bg-opacity-50 p-4 rounded text-center text-yellow-100">
            No AI responses yet—<br />speak to begin!
          </div>
          {/* Future feedback/analysis will go here */}
        </aside>
      </main>
    </div>
  );
}
