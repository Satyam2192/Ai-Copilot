import React, { useState, useEffect } from 'react';
import Chat from './Chat';
// Import specific functions - removed apiLogout
import { listSessions, deleteSession as apiDeleteSession } from '../services/api';
import { logoutUser } from '../features/auth/authSlice'; // Import logoutUser action
import { useDispatch } from 'react-redux';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'; // Import resizable panels

export default function Dashboard({ user, onLogout }) {
  const dispatch = useDispatch(); // Initialize dispatch
  const [latestAiResponse, setLatestAiResponse] = useState('');
  const [sessions, setSessions] = useState([]); // State for session list
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false); // Default to hidden
  const [isHeaderVisible, setIsHeaderVisible] = useState(true); // State for header visibility
  const [panelDirection, setPanelDirection] = useState('horizontal'); // State for panel direction

  // Effect to handle responsive panel direction
  useEffect(() => {
    const checkSize = () => {
      // Tailwind's 'md' breakpoint is 768px
      setPanelDirection(window.innerWidth < 768 ? 'vertical' : 'horizontal');
    };

    // Initial check
    checkSize();

    // Add listener
    window.addEventListener('resize', checkSize);

    // Cleanup listener
    return () => window.removeEventListener('resize', checkSize);
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // Fetch sessions function
  const fetchSessions = async () => {
    setLoadingSessions(true);
    setSessionError(null);
    try {
      // Use the imported function
      const res = await listSessions(); 
      setSessions(res.data || []); // Ensure it's an array
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setSessionError('Could not load past sessions.');
      setSessions([]); // Clear sessions on error
    } finally {
      setLoadingSessions(false);
    }
  };

  // Fetch sessions on mount
  useEffect(() => {
    // Call the fetchSessions function defined above
    fetchSessions(); 
  }, []); // Run only on mount

  const handleNewAiResponse = (responseText) => {
    setLatestAiResponse(responseText);
    // Optional: Refresh session list if a new message implies session activity change
    // fetchSessions(); // Could be too frequent, consider alternative triggers
  };

  const handleLogout = () => { // No longer needs async
    try {
      // Dispatch the logout action from the slice
      dispatch(logoutUser()); 
      // localStorage is cleared by the thunk, but keep here for immediate effect if needed
      localStorage.removeItem('token'); 
      onLogout(); // Call the prop function passed from App.js
    } catch (error) {
      console.error('Logout failed:', error);
      // Optionally display an error message
    }
  };

  // Handle deleting a session
  const handleDeleteSession = async (sessionIdToDelete) => {
    // Optional: Add confirmation dialog here
    // if (!window.confirm('Are you sure you want to delete this session?')) {
    //   return;
    // }

    try {
      await apiDeleteSession(sessionIdToDelete);
      // Remove the session from the local state
      setSessions(prevSessions => prevSessions.filter(session => session._id !== sessionIdToDelete));
      // If the deleted session was selected, clear the selection
      if (selectedSessionId === sessionIdToDelete) {
        setSelectedSessionId(null);
      }
      console.log(`Session ${sessionIdToDelete} deleted successfully.`);
    } catch (err) {
      console.error(`Failed to delete session ${sessionIdToDelete}:`, err);
      setSessionError('Could not delete session.'); // Show error to user
      // Optionally display an error message
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header - Modified for toggling content */}
      <header className={`relative bg-gray-800 shadow-md z-10 transition-all duration-300 ease-in-out ${isHeaderVisible ? 'p-4' : 'py-1'}`}> {/* Adjust padding when hidden */}
        {/* Central Toggle Button - Always Visible */}
        <div className="absolute inset-x-0 top-0 flex justify-center">
          <button
            onClick={() => setIsHeaderVisible(!isHeaderVisible)}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 mt-1" // Small padding and margin-top
            title={isHeaderVisible ? "Hide Header" : "Show Header"}
          >
            {/* Chevron Up/Down Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              {isHeaderVisible ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /> // Chevron Up
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /> // Chevron Down
              )}
            </svg>
          </button>
        </div>

        {/* Conditionally Rendered Header Content */}
        {isHeaderVisible && (
          <div className="flex justify-between items-center sm:flex-row sm:space-y-0 "> {/* Responsive flex layout */}
            {/* Removed History Toggle Button from here */}
            <div className="flex items-center"> {/* Group title */}
              <h1 className="text-xl font-bold ml-2">Co-Pilot</h1> {/* Added margin-left */}
            </div>
            <div className="flex flex-col items-start space-y-2 sm:flex-row sm:items-center sm:space-y-0"> {/* Responsive user/logout */}
              {/* <span className="sm:mr-4 text-gray-300">{user.email}</span> */}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded focus:outline-none focus:shadow-outline"
              >
                Log out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area - Use PanelGroup */}
      {/* The main area should naturally flow below the header */}
      <main className="relative flex flex-grow overflow-hidden"> {/* Add relative positioning for the toggle button */}

        {/* Left Sidebar Toggle Button - Always Visible */}
        <button
          onClick={() => setIsHistoryVisible(!isHistoryVisible)}
          className="absolute top-1/2 left-0 transform -translate-y-1/2 z-20 p-1 bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white rounded-r-md focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 transition-colors"
          title={isHistoryVisible ? "Hide History" : "Show History"}
          style={{ marginLeft: isHistoryVisible ? '16rem' : '0', transition: 'margin-left 0.3s ease-in-out' }} // Adjust margin based on visibility
        >
          {/* Chevron Left/Right Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            {isHistoryVisible ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /> // Chevron Left
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /> // Chevron Right
            )}
          </svg>
        </button>

        {/* Left Sidebar - Session List (Conditionally Rendered) */}
        {isHistoryVisible && (
          <aside className="w-full sm:w-64 bg-gray-800 p-4 flex-shrink-0 overflow-y-auto border-r border-gray-700 transition-all duration-300 ease-in-out z-30"> {/* Responsive width, added z-index */}
            {/* Consider adding absolute positioning for overlay effect on small screens if needed */}
            <button
              onClick={() => setSelectedSessionId(null)} // Start new chat
              className="w-full mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none focus:shadow-outline transition-colors"
            >
              + New Chat
            </button>
            <h2 className="text-lg font-semibold mb-2 text-gray-300">Past Sessions</h2>
            {loadingSessions && <p className="text-gray-400">Loading sessions...</p>}
            {sessionError && <p className="text-red-400 text-sm">{sessionError}</p>}
            <ul className="space-y-1"> {/* Reduced spacing slightly */}
              {sessions.map((session) => (
                <li key={session._id} className="flex items-center justify-between group hover:bg-gray-700 rounded"> {/* Group for hover effect */}
                  <button
                    onClick={() => setSelectedSessionId(session._id)}
                    className={`flex-grow text-left px-3 py-2 rounded-l text-sm transition-colors ${
                      selectedSessionId === session._id
                        ? 'bg-gray-600 text-white' // Slightly different selected background
                        : 'text-gray-400 group-hover:text-white' // Use group-hover
                    }`}
                  >
                    <p className="font-medium truncate">{session.topic || 'Untitled Session'}</p>
                    <p className="text-xs text-gray-500 group-hover:text-gray-400"> {/* Use group-hover */}
                      {new Date(session.startTime).toLocaleDateString()} {/* Simpler date format */}
                    </p>
                  </button>
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering the session selection
                      handleDeleteSession(session._id);
                    }}
                    className="p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none rounded-r" // Show on hover
                    title="Delete Session"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* Resizable Panel Group for Chat and Response */}
        {/* Bind direction to state */}
        <PanelGroup direction={panelDirection} className="flex-grow"> {/* PanelGroup takes flex-grow */}
          {/* Center Panel - Conversation Area */}
          <Panel defaultSize={65} minSize={30} className="flex flex-col"> {/* Ensure panel takes space */}
            <div className="flex-grow overflow-y-auto bg-gray-900"> {/* Use flex-grow */}
              {/* Use key to force re-mount when session changes */}
              <Chat
                key={selectedSessionId || 'new'} // Key prop
                user={user} // Pass user prop
                onNewAiResponse={handleNewAiResponse} // Pass callback prop
                initialSessionId={selectedSessionId} // Pass selected session ID prop
              />
            </div>
          </Panel>

          {/* Resize Handle - Conditionally apply classes based on direction state */}
          <PanelResizeHandle className={`bg-gray-700 hover:bg-blue-600 active:bg-blue-700 transition-colors flex items-center justify-center ${panelDirection === 'vertical' ? 'h-2 w-full' : 'w-2 h-full'}`}>
            {/* Visual indicator - adjust based on direction */}
            <div className={`bg-gray-500 rounded-full ${panelDirection === 'vertical' ? 'h-1 w-8' : 'w-1 h-8'}`}></div>
          </PanelResizeHandle>

          {/* Right Panel - Display the latest response */}
          {/* Consider hiding this panel on small screens if vertical split is too cramped: hidden md:flex */}
          <Panel defaultSize={35} minSize={20} className="flex flex-col"> {/* Ensure panel takes space */}
            {/* Conditionally apply border based on direction */}
            <aside className={`flex-grow bg-gray-800 p-4 overflow-y-auto border-gray-700 ${panelDirection === 'vertical' ? 'border-t' : 'border-l'}`}>
              <h2 className="text-xl font-bold mb-4">Latest AI Response</h2>
              <div className="bg-gray-700 p-4 rounded text-gray-200 text-sm whitespace-pre-wrap min-h-[100px]">
                {latestAiResponse ? latestAiResponse : (
                  <span className="text-gray-400 italic">Select a session or start a new chat.</span>
                )}
              </div>
              {/* Future feedback/analysis could go below */}
            </aside>
          </Panel>
        </PanelGroup>
      </main>
    </div>
  );
}
