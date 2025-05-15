import React, { useState, useEffect } from 'react';
import Chat from './Chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Import specific functions
import { listSessions, deleteSession as apiDeleteSession } from '../services/api';
import { logoutUser } from '../features/auth/authSlice';
import { useDispatch } from 'react-redux';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

export default function Dashboard({ user, onLogout }) {
  const dispatch = useDispatch();
  const [latestAiResponse, setLatestAiResponse] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [panelDirection, setPanelDirection] = useState('horizontal');

  // CodeBlockComponent removed for this test step

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
  }, []);

  // Fetch sessions function
  const fetchSessions = async () => {
    setLoadingSessions(true);
    setSessionError(null);
    try {
      // Use the imported function
      const res = await listSessions();
      setSessions(res.data || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setSessionError('Could not load past sessions.');
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Effect to update URL when selectedSessionId changes
  useEffect(() => {
    const path = selectedSessionId ? (selectedSessionId === 'global' ? '/chat/global' : `/chat/${selectedSessionId}`) : '/';
    if (window.location.pathname !== path) {
      window.history.pushState({ sessionId: selectedSessionId }, '', path);
    }
  }, [selectedSessionId]);

  // Effect to handle URL changes (e.g., browser back/forward, direct navigation)
  useEffect(() => {
    const handlePopState = (event) => {
      const pathParts = window.location.pathname.split('/');
      if (pathParts.length === 3 && pathParts[1] === 'chat') {
        const idFromUrl = pathParts[2];
        setSelectedSessionId(idFromUrl);
      } else if (window.location.pathname === '/') {
        setSelectedSessionId(null); // For new chat
      }
    };

    // Set initial selectedSessionId from URL on component mount
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length === 3 && pathParts[1] === 'chat') {
      setSelectedSessionId(pathParts[2]);
    } else {
      // Default to new chat if no specific session in URL, or if it's just '/'
      // setSelectedSessionId(null); // This might conflict with initialSessionId prop in Chat, let Chat handle its own initial state.
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);


  const handleNewAiResponse = (responseText) => {
    setLatestAiResponse(responseText);
  };

  const handleLogout = () => {
    try {
      dispatch(logoutUser());
      localStorage.removeItem('token');
      onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Handle deleting a session
  const handleDeleteSession = async (sessionIdToDelete) => {
    try {
      await apiDeleteSession(sessionIdToDelete);
      setSessions(prevSessions => prevSessions.filter(session => session._id !== sessionIdToDelete));
      if (selectedSessionId === sessionIdToDelete) {
        setSelectedSessionId(null);
      }
      console.log(`Session ${sessionIdToDelete} deleted successfully.`);
    } catch (err) {
      console.error(`Failed to delete session ${sessionIdToDelete}:`, err);
      setSessionError('Could not delete session.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header - Modified for toggling content */}
      <header className={`relative bg-gray-800 shadow-md z-10 transition-all duration-300 ease-in-out ${isHeaderVisible ? 'p-4' : 'py-1'}`}>
        {/* Central Toggle Button - Always Visible */}
        <div className="absolute inset-x-0 top-0 flex justify-center">
          <button
            onClick={() => setIsHeaderVisible(!isHeaderVisible)}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 mt-1"
            title={isHeaderVisible ? "Hide Header" : "Show Header"}
          >
            {/* Chevron Up/Down Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              {isHeaderVisible ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Conditionally Rendered Header Content */}
        {isHeaderVisible && (
          <div className="flex justify-between items-center sm:flex-row sm:space-y-0 ">
            <div className="flex items-center">
              <h1 className="text-xl font-bold ml-2">Co-Pilot</h1>
            </div>
            <div className="flex items-center space-x-2">
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
      <main className="relative flex flex-grow overflow-hidden">

        {/* Left Sidebar Toggle Button - Always Visible */}
        <button
          onClick={() => setIsHistoryVisible(!isHistoryVisible)}
          className="absolute top-1/2 left-0 transform -translate-y-1/2 z-40 p-1 bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white rounded-r-md focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 transition-colors"
          title={isHistoryVisible ? "Hide History" : "Show History"}
          style={{ marginLeft: isHistoryVisible && panelDirection === 'horizontal' ? '16rem' : '0', transition: 'margin-left 0.3s ease-in-out' }}
        >
          {/* Chevron Left/Right Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            {isHistoryVisible ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            )}
          </svg>
        </button>

        {/* Left Sidebar - Session List (Conditionally Rendered) */}
        {isHistoryVisible && (
          <aside className="w-full sm:w-64 bg-gray-800 p-4 flex-shrink-0 overflow-y-auto border-r border-gray-700 transition-all duration-300 ease-in-out z-30">
            <button
              onClick={() => {
                setSelectedSessionId(null);
                setIsHistoryVisible(false);
              }}
              className="w-full mb-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none focus:shadow-outline transition-colors"
            >
              + New Chat
            </button>
            
            {/* Global Chat Button */}
            <button
              onClick={() => {
                setSelectedSessionId('global');
                setIsHistoryVisible(false);
              }}
              className={`w-full mb-4 px-4 py-2 text-white rounded focus:outline-none focus:shadow-outline transition-colors ${
                selectedSessionId === 'global'
                  ? 'bg-purple-700 hover:bg-purple-800'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              🌎 Global Chat
            </button>
            
            <h2 className="text-lg font-semibold mb-2 text-gray-300">Past Sessions</h2>
            {loadingSessions && <p className="text-gray-400">Loading sessions...</p>}
            {sessionError && <p className="text-red-400 text-sm">{sessionError}</p>}
            <ul className="space-y-1">
              {sessions.map((session) => (
                <li key={session._id} className="flex items-center justify-between group hover:bg-gray-700 rounded">
                  <button
                    onClick={() => {
                      setSelectedSessionId(session._id);
                      setIsHistoryVisible(false);
                    }}
                    className={`flex-grow text-left px-3 py-2 rounded-l text-sm transition-colors ${
                      selectedSessionId === session._id
                        ? 'bg-gray-600 text-white'
                        : 'text-gray-400 group-hover:text-white'
                    }`}
                  >
                    <p className="font-medium truncate">{session.topic || 'Untitled Session'}</p>
                    <p className="text-xs text-gray-500 group-hover:text-gray-400">
                      {new Date(session.startTime).toLocaleDateString()}
                    </p>
                  </button>
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session._id);
                    }}
                    className="p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none rounded-r"
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
        <PanelGroup key={panelDirection} direction={panelDirection} className="flex-grow">
          {/* Center Panel - Conversation Area */}
          <Panel defaultSize={100} minSize={30} className="flex flex-col">
            <div className="flex-grow overflow-y-auto bg-gray-900">
              {/* Use key to force re-mount when session changes */}
              <Chat
                key={selectedSessionId || 'new'}
                user={user}
                onNewAiResponse={handleNewAiResponse}
                initialSessionId={selectedSessionId}
              />
            </div>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className={`bg-gray-700 hover:bg-blue-600 active:bg-blue-700 transition-colors flex items-center justify-center ${panelDirection === 'vertical' ? 'h-2 w-full' : 'w-2 h-full'}`}>
            <div className={`bg-gray-500 rounded-full ${panelDirection === 'vertical' ? 'h-1 w-8' : 'w-1 h-8'}`}></div>
          </PanelResizeHandle>

          {/* Right Panel - Display the latest response */}
          <Panel
            defaultSize={0}
            minSize={0}
            className="flex flex-col"
          >
            <aside className={`flex-grow bg-gray-800 p-4 overflow-y-auto border-gray-700 ${panelDirection === 'vertical' ? 'border-t' : 'border-l'}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Latest AI Response</h2>
              </div>

              <div className="bg-gray-700 p-4 rounded text-gray-200 min-h-[100px] markdown-body">
                {/* Test with a hardcoded simple Markdown string and no plugins/components */}
                <ReactMarkdown>
                  {`# Test Heading 1
This is **bold text** and this is *italic text*.
This is \`inline code\`.`}
                </ReactMarkdown>
                {/* 
                {latestAiResponse ? (
                  <ReactMarkdown
                    // remarkPlugins={[remarkGfm]}
                    // rehypePlugins={[rehypeRaw]}
                    // components={{
                    //   code: CodeBlockComponent, // CodeBlockComponent is removed for this test
                    // }}
                  >
                    {latestAiResponse}
                  </ReactMarkdown>
                ) : (
                  <span className="text-gray-400 italic">Select a session or start a new chat.</span>
                )}
                */}
              </div>
            </aside>
          </Panel>
        </PanelGroup>
      </main>
    </div>
  );
}
