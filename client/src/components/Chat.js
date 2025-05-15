import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Import specific API functions
import { 
  getSession,
  startSession, 
  sendMessage, 
  updateSession,
  getGlobalChat,
  joinGlobalChat,
  leaveGlobalChat,
  sendGlobalChatMessage,
  clearGlobalChatAPI
} from '../services/api';

// Check for SpeechRecognition API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.continuous = true; // Keep listening even after pauses
  recognition.interimResults = true; // Get results while speaking
  recognition.lang = 'en-US'; // Set language
}

// SVG Icon components
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 4.625a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

// Accept onNewAiResponse and initialSessionId props
export default function Chat({ user, onNewAiResponse, initialSessionId = null }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Connecting...');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [systemPrompt, setSystemPrompt] = useState(''); // Current input value
  const [savedSystemPrompt, setSavedSystemPrompt] = useState(''); // Last saved value
  const [isSavingPrompt, setIsSavingPrompt] = useState(false); // Loading state for saving prompt
  const [isSystemPromptVisible, setIsSystemPromptVisible] = useState(false); // State for prompt visibility
  const [isRecording, setIsRecording] = useState(false);
  const [speechApiAvailable, setSpeechApiAvailable] = useState(!!recognition);
  const [copiedStates, setCopiedStates] = useState({});
  const recognitionRef = useRef(recognition);
  const isManuallyStoppingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); // Ref for the chat input element
  const ws = useRef(null); // WebSocket reference

  // Define available models
  const availableModels = [
    { id: 'gemini-2.0-flash-001', name: 'Gemini 2 Flash' },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2 Pro' },
    { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro-exp-03-25', name: 'Gemini 2.5 Pro' },
    // Add other models as needed, e.g., 'gemini-pro'
  ];

  // Flag to identify if this is a global chat
  const [isGlobalChat, setIsGlobalChat] = useState(false);

  // Load existing session or create new one on mount
  useEffect(() => {
    const initializeSession = async () => {
      setError(null); // Clear previous errors
      
      // Check if this is the global chat
      if (initialSessionId === 'global') {
        // --- Load Global Chat ---
        try {
          setIsGlobalChat(true);
          setStatus('Loading global chat...');
          setLoading(true); // Indicate loading state
          
          // Join global chat to mark user as active
          await joinGlobalChat();
          
          // Get global chat data
          const res = await getGlobalChat();
          
          // Transform messages to match our component's format
          const formattedMessages = res.data.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            sender: msg.sender?.userId || 'system',
            messageId: msg._id
          }));
          
          setMessages(formattedMessages || []);
          setSessionId('global'); // Use 'global' as the session ID for WebSocket
          setSystemPrompt('');
          setSavedSystemPrompt('');
          setStatus('Global chat loaded');
          
        } catch (err) {
          console.error('Failed to load global chat:', err);
          setError(`Failed to load global chat. ${err.response?.data?.error || err.message}`);
          setStatus('Global chat load failed');
        } finally {
          setLoading(false);
        }
        
      } else if (initialSessionId && initialSessionId !== 'global') {
        // --- Load Existing Session (Regular Chat) ---
        try {
          setIsGlobalChat(false);
          setStatus(`Loading session ${initialSessionId}...`);
          setLoading(true); // Indicate loading state
          // Use imported getSession function
          const res = await getSession(initialSessionId); 
          const sessionData = res.data;

          setMessages(sessionData.messages || []);
          setSessionId(sessionData._id);
          setSystemPrompt(sessionData.systemPrompt || '');
          setSavedSystemPrompt(sessionData.systemPrompt || '');
          setStatus('Session loaded');

        } catch (err) {
          console.error(`Failed to load session ${initialSessionId}:`, err);
          setError(`Failed to load session. ${err.response?.data?.error || err.message}`);
          setStatus('Session load failed');
          // Optionally fall back to creating a new session or show an error state
        } finally {
          setLoading(false);
        }

      } else {
        // --- Create New Session ---
        try {
          setIsGlobalChat(false);
          setStatus('Creating new session...');
          setLoading(true);
          // Send initial system prompt value when creating
          // Use imported startSession function
          const res = await startSession({ systemPrompt }); 
          setSessionId(res.data.sessionId);
          setSavedSystemPrompt(res.data.systemPrompt); // Store the initial saved prompt
          setMessages([]); // Start with empty messages for new session
          setStatus('New session active');
        } catch (err) {
          console.error('New session creation failed:', err);
          setError('Failed to create session. Please try again.');
          setStatus('Session creation failed');
        } finally {
          setLoading(false);
        }
      }
    };

    initializeSession();
  }, [initialSessionId]);
  
  // Clean up when unmounting - leave global chat if necessary
  useEffect(() => {
    return () => {
      if (isGlobalChat) {
        // Leave global chat when component unmounts
        leaveGlobalChat().catch(err => {
          console.error('Error leaving global chat:', err);
        });
      }
    };
  }, [isGlobalChat]);

  // --- Additional state for live chat features ---
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [readReceipts, setReadReceipts] = useState({});
  const typingTimeoutRef = useRef(null);

  // Helper function to remove duplicates based on userId
  const getUniqueUsers = (users) => {
    if (!Array.isArray(users)) return [];
    const seen = new Set();
    return users.filter(user => {
      if (!user || typeof user.userId === 'undefined') return false; // Ensure user and userId exist
      const duplicate = seen.has(user.userId);
      seen.add(user.userId);
      return !duplicate;
    });
  };
  
  // --- WebSocket Connection ---

  const handleClearGlobalChat = async () => {
    if (!isGlobalChat || loading) return;

    if (window.confirm('Are you sure you want to clear all messages in the global chat? This cannot be undone.')) {
      setLoading(true);
      setError(null);
      try {
        await clearGlobalChatAPI();
        // Optimistically update UI for the clearer
        setMessages([{
          role: 'system',
          content: 'Global chat was cleared by you.',
          timestamp: new Date().toISOString()
        }]);
        setStatus('Global chat cleared by you.');

        // Notify other clients via WebSocket
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'broadcast_clear_chat',
            chatId: 'global',
            userId: user?._id // Include who initiated for server-side logging/attribution if needed
          }));
        }
        console.log('Global chat clear initiated and broadcast signal sent.');
      } catch (err) {
        console.error('Failed to clear global chat:', err);
        setError(`Failed to clear global chat. ${err.response?.data?.error || err.message}`);
        setStatus('Failed to clear global chat.');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    console.log('[WebSocket Effect] Running. SessionId:', sessionId, 'User ID:', user?._id);
    if (sessionId && user?._id) {
      // Use REACT_APP_SOCKET_URL environment variable if available, otherwise default to the production WebSocket URL
      const wsUrl = process.env.REACT_APP_SOCKET_URL || 'wss://aicopilot.onrender.com';
      
      console.log(`[WebSocket] Attempting to connect to: ${wsUrl} (SessionId: ${sessionId}, UserID: ${user._id}, Using env var: ${!!process.env.REACT_APP_SOCKET_URL})`);
      setStatus(`Connecting to WebSocket...`);
      
      try {
        ws.current = new WebSocket(wsUrl);
      } catch (e) {
        console.error('[WebSocket] Error creating WebSocket instance:', e);
        setError('Failed to create WebSocket. See console.');
        setStatus('WebSocket creation error.');
        return;
      }

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setStatus('Real-time service connected.');
        if (ws.current && ws.current.readyState === WebSocket.OPEN && sessionId) {
          // Send join message with more details
          ws.current.send(JSON.stringify({
            type: 'join_chat',
            chatId: sessionId,
            userId: user?._id,
            username: user?.name || user?.email || 'Anonymous'
          }));
          console.log(`Sent join_chat for ${sessionId}`);
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const receivedMsg = JSON.parse(event.data);
          console.log('WebSocket message received:', receivedMsg);

          // Handle different message types
          switch (receivedMsg.type) {
            case 'global_chat_cleared':
              if (receivedMsg.chatId === 'global' && sessionId === 'global') {
                const clearedByCurrentUser = receivedMsg.clearedBy === user?._id;
                setMessages([{
                  role: 'system',
                  content: `Global chat was cleared ${clearedByCurrentUser ? 'by you' : `by user ${receivedMsg.clearedBy}`}.`, // Consider showing username if available
                  timestamp: receivedMsg.timestamp || new Date().toISOString()
                }]);
                setStatus('Global chat cleared.');
                console.log(`Global chat cleared event received. Cleared by: ${receivedMsg.clearedBy}`);
              }
              break;
            case 'join_success':
              // Server confirms successful join
              console.log(`Successfully joined chat ${receivedMsg.chatId}`);
              break;
              
            case 'user_joined':
              // Another user joined the chat
              if (receivedMsg.chatId === sessionId) {
                console.log(`User joined: ${receivedMsg.userId}`);
                // Update the active users list, ensuring uniqueness
                setActiveUsers(getUniqueUsers(receivedMsg.activeUsers || []));
                // Optionally show a notification
                if (receivedMsg.userId !== user?._id) {
                  setStatus(`${receivedMsg.username || 'Someone'} joined the chat`);
                  setTimeout(() => setStatus('Real-time service connected.'), 3000);
                }
              }
              break;
              
            case 'user_left':
              // Another user left the chat
              if (receivedMsg.chatId === sessionId) {
                console.log(`User left: ${receivedMsg.userId}`);
                // Update the active users list, ensuring uniqueness
                setActiveUsers(getUniqueUsers(receivedMsg.activeUsers || []));
                // Remove from typing users
                setTypingUsers(prev => prev.filter(u => u.userId !== receivedMsg.userId));
                // Optionally show a notification
                setStatus(`${receivedMsg.username || 'Someone'} left the chat`);
                setTimeout(() => setStatus('Real-time service connected.'), 3000);
              }
              break;
              
            case 'new_message':
              // New message received
              if (receivedMsg.chatId === sessionId && receivedMsg.sender !== user?._id) {
                console.log('Adding message to UI:', receivedMsg.text); // Use receivedMsg.text
                
                // Determine if it's an AI message
                const isAiMessage = receivedMsg.sender === 'ai' || receivedMsg.sender === 'GLOBAL_AI_ASSISTANT';
                
                // Create message object with a consistent structure
                const newMessage = {
                  role: isAiMessage ? 'assistant' : 'user', // Display as AI or user message
                  content: receivedMsg.content,
                  timestamp: receivedMsg.timestamp,
                  sender: receivedMsg.sender,
                  messageId: receivedMsg.messageId
                };
                
                setMessages(prevMessages => {
                  // Avoid adding duplicate messages
                  const messageExists = prevMessages.some(
                    msg => msg.messageId === receivedMsg.messageId ||
                           (msg.content === receivedMsg.content && 
                            msg.timestamp === receivedMsg.timestamp && 
                            msg.sender === receivedMsg.sender)
                  );
                  if (messageExists) {
                    console.log('Duplicate message detected, not adding.');
                    return prevMessages;
                  }
                  return [...prevMessages, newMessage];
                });
                
                // Remove user from typing list when their message arrives
                setTypingUsers(prev => prev.filter(u => u.userId !== receivedMsg.sender));
                
                // Send read receipt
                if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                  ws.current.send(JSON.stringify({
                    type: 'message_read',
                    chatId: sessionId,
                    messageId: receivedMsg.messageId,
                    userId: user?._id
                  }));
                }
              }
              break;
              
            case 'typing_status':
              // Someone is typing
              if (receivedMsg.chatId === sessionId && receivedMsg.userId !== user?._id) {
                if (receivedMsg.isTyping) {
                  // Add to typing users
                  setTypingUsers(prev => {
                    if (!prev.some(u => u.userId === receivedMsg.userId)) {
                      return [...prev, {
                        userId: receivedMsg.userId,
                        username: receivedMsg.username || 'Someone'
                      }];
                    }
                    return prev;
                  });
                } else {
                  // Remove from typing users
                  setTypingUsers(prev => prev.filter(u => u.userId !== receivedMsg.userId));
                }
              }
              break;
              
            case 'message_read':
              // Message was read by someone
              if (receivedMsg.chatId === sessionId) {
                setReadReceipts(prev => ({
                  ...prev,
                  [receivedMsg.messageId]: [
                    ...(prev[receivedMsg.messageId] || []),
                    receivedMsg.userId
                  ]
                }));
              }
              break;
              
            case 'user_info_update':
              // User info was updated
              if (receivedMsg.chatId === sessionId) {
                // Update active users with new info
                setActiveUsers(prev => 
                  prev.map(u => 
                    u.userId === receivedMsg.userId 
                      ? { ...u, username: receivedMsg.username }
                      : u
                  )
                );
                
                // Update typing users with new info
                setTypingUsers(prev => 
                  prev.map(u => 
                    u.userId === receivedMsg.userId 
                      ? { ...u, username: receivedMsg.username }
                      : u
                  )
                );
              }
              break;
              
            default:
              console.log(`Unhandled message type: ${receivedMsg.type}`, receivedMsg);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.current.onerror = (event) => {
        console.error('[WebSocket] Connection Error:', event);
        let errorDetails = 'WebSocket connection error.';
        if (event.message) errorDetails += ` Message: ${event.message}`;
        if (event.code) errorDetails += ` Code: ${event.code}`;

        setError(errorDetails + ' Check browser console for more details.');
        setStatus('WebSocket connection error.');
      };

      ws.current.onclose = (event) => {
        console.log('[WebSocket] Disconnected.', `Code: ${event.code}, Reason: "${event.reason}", WasClean: ${event.wasClean}`);
        let closeReason = `WebSocket disconnected. Code: ${event.code}.`;
        if (event.reason) {
          closeReason += ` Reason: ${event.reason}`;
        }
        // Only set error if it wasn't a clean close or if no open event fired
        if (!event.wasClean && status !== 'Real-time service connected.') {
            setError(closeReason);
            setStatus('WebSocket disconnected with error.');
        } else if (status === 'Real-time service connected.') { // if it was connected then disconnected
            setStatus('Real-time service disconnected.');
        } else { // if it never connected
            setStatus('WebSocket connection failed to open.');
            if (!error) { // If no specific error was already set by onerror
                 setError(closeReason + ' Connection could not be established.');
            }
        }
      };

      // Cleanup on component unmount or when sessionId/user changes
      return () => {
        if (ws.current) {
          ws.current.close();
          ws.current = null;
        }
      };
    }
  }, [sessionId, user?._id]); // Reconnect if sessionId or user._id changes


  // --- Global Key Listener for Input Focus ---
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      // Ignore if modifier keys are pressed (except Shift for typing uppercase)
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');

      // Check if a non-input element is focused AND the key is likely for typing
      // (e.g., single characters, numbers, symbols, space, backspace)
      // This is a simplified check; more complex logic could be added for edge cases.
      const isTypingKey = event.key.length === 1 || event.key === 'Backspace' || event.key === 'Spacebar' || event.key === ' '; // Spacebar for older browsers

      if (!isInputFocused && isTypingKey && inputRef.current) {
        // Prevent default action for keys like spacebar scrolling the page
        if (event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
        }
        inputRef.current.focus();
        // Note: We just focus. The key press event will then naturally type into the focused input.
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount


  // --- Speech Recognition Logic ---

  // Removed useCallback here as sendTranscript dependency makes it complex
  // We'll rely on the useEffect cleanup/re-attach logic
  const handleRecognitionResult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    // Send the final transcript automatically
    if (finalTranscript) {
        const trimmedTranscript = finalTranscript.trim();
        console.log('Final Transcript (sending):', trimmedTranscript);
        if (trimmedTranscript) { // Ensure we don't send empty strings
            sendTranscript(trimmedTranscript);
            // Do NOT modify the 'input' state here, it's for typed messages
        }
    }
    // Optional: Display interim transcript somewhere if needed
     // console.log('Interim Transcript:', interimTranscript);

  }; // End of handleRecognitionResult

  const handleRecognitionError = useCallback((event) => {
    console.error('Speech recognition error:', event.error, event.message);
    let errorMessage = `Speech recognition error: ${event.error}`;
    if (event.message) {
        errorMessage += ` - ${event.message}`;
    }
    setError(errorMessage);

    const criticalErrors = ['not-allowed', 'service-not-allowed', 'network'];
    if (criticalErrors.includes(event.error)) {
        console.log('Critical speech error, stopping recording state.');
        setIsRecording(false);
        isManuallyStoppingRef.current = true;
    } else if (event.error === 'no-speech' || event.error === 'audio-capture') {
        // For 'no-speech' or 'audio-capture' (which can be temporary),
        // allow 'onend' to attempt a restart if still in recording mode.
        // Do not change isRecording or isManuallyStoppingRef here.
        console.log(`Speech error (${event.error}), allowing 'onend' to handle potential restart.`);
    } else {
        // For other unexpected errors, treat them as needing a manual reset.
        console.log(`Other speech error (${event.error}), stopping recording state.`);
        setIsRecording(false);
        isManuallyStoppingRef.current = true;
    }
  }, [setError]);

  // End handler with restart logic for continuous listening
  const handleRecognitionEnd = useCallback(() => {
    console.log('Speech recognition ended.');

    if (isManuallyStoppingRef.current) {
        console.log('Manual stop or critical error detected in onend, not restarting.');
        isManuallyStoppingRef.current = false;
        setIsRecording(false);
        return;
    }

    if (isRecording && recognitionRef.current) {
        console.log('Non-manual stop detected, attempting immediate restart...');
        try {
            recognitionRef.current.start();
            console.log('Recognition restarted immediately.');
        } catch (e) {
            console.error("Error restarting recognition immediately:", e);
            if (e.name === 'InvalidStateError') {
                 console.warn("Restart attempt failed: Recognition was likely already running or starting.");
            } else {
                setError("Mic failed to restart. Please try toggling it off/on.");
                setIsRecording(false);
            }
        }
    } else {
        console.log('Recognition ended, but isRecording is false. No restart needed.');
        setIsRecording(false);
    }
  }, [isRecording, setError]);

  // Effect to attach/detach listeners
  useEffect(() => {
    const currentRecognition = recognitionRef.current;
    if (!currentRecognition) return;

    currentRecognition.addEventListener('result', handleRecognitionResult);
    currentRecognition.addEventListener('error', handleRecognitionError);
    currentRecognition.addEventListener('end', handleRecognitionEnd);

    // Cleanup function
    return () => {
      currentRecognition.removeEventListener('result', handleRecognitionResult);
      currentRecognition.removeEventListener('error', handleRecognitionError);
      currentRecognition.removeEventListener('end', handleRecognitionEnd);
      // Ensure recognition is stopped if component unmounts while recording
      if (isRecording) {
          currentRecognition.stop();
      }
    };
  }, [handleRecognitionResult, handleRecognitionError, handleRecognitionEnd, isRecording]); // Re-attach if handlers change (due to dependencies) or isRecording changes


  const toggleRecording = () => {
    if (!recognitionRef.current) {
        setError("Speech recognition not available in this browser.");
        return;
    }

    if (isRecording) {
      console.log('Stopping recognition manually...');
      isManuallyStoppingRef.current = true; // Signal manual stop
      setIsRecording(false); // Set state immediately for instant UI feedback
      recognitionRef.current.stop();
      // handleRecognitionEnd will still fire, see the ref, and confirm state is false
    } else {
      // Double-check state just before starting
      if (!isRecording) {
          console.log('Starting recognition...');
          setError(null); // Clear previous errors
          try {
              recognitionRef.current.start();
              setIsRecording(true); // Set state AFTER successful start attempt
          } catch(e) {
              console.error("Error starting recognition:", e);
              setError("Failed to start microphone. Check permissions or if already active.");
              setIsRecording(false); // Ensure state is false on error
          }
      } else {
          console.warn("Attempted to start recognition when already recording.");
      }
    }
  };

  // --- End Speech Recognition Logic ---


  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to send text (either typed or transcribed)
  const sendTextToServer = async (textToSend) => {
    if (!textToSend || loading || !sessionId) return;

    setLoading(true);
    setError(null);

    // Add user message to UI immediately using role/content
    const timestamp = new Date().toISOString();
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setMessages(prev => [...prev, {
      role: 'user', // Use role
      content: textToSend, // Use content
      timestamp: timestamp,
      sender: user?._id, // Add sender to optimistic update
      messageId: messageId
    }]);

    // Send message via WebSocket
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const wsMessage = {
        type: 'chat_message', // Add type for chat messages
        text: textToSend,
        chatId: sessionId,
        sender: user?._id || 'unknown_user', // Ensure sender is included
        messageId: messageId
      };
      ws.current.send(JSON.stringify(wsMessage));
      console.log('Message sent via WebSocket:', wsMessage);
    } else {
      console.warn('WebSocket not connected. Message not sent in real-time to other clients.');
    }

    try {
      // Handle differently based on whether this is global chat or regular chat
      if (isGlobalChat) {
        // For global chat, the API now handles AI response generation and returns it.
        const res = await sendGlobalChatMessage(textToSend);
        console.log('Global chat message and AI response processed by API:', res.data);

        if (res.data && res.data.success && res.data.aiMessage) {
          const aiMessage = {
            role: 'assistant',
            content: res.data.aiMessage.content,
            timestamp: res.data.aiMessage.timestamp || new Date().toISOString(),
            sender: res.data.aiMessage.sender.userId || 'GLOBAL_AI_ASSISTANT', // Ensure sender ID is used
            messageId: res.data.aiMessage._id || `ai-${Date.now()}` // Use _id from DB if available
          };
          
          // Add AI message to UI
          setMessages(prev => [...prev, aiMessage]);

          // Broadcast AI message via WebSocket
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            const wsAiMessage = {
              type: 'chat_message',
              text: aiMessage.content,
              chatId: 'global', // Explicitly 'global'
              sender: aiMessage.sender, // This should be 'GLOBAL_AI_ASSISTANT'
              messageId: aiMessage.messageId
            };
            ws.current.send(JSON.stringify(wsAiMessage));
            console.log('Global AI response broadcast via WebSocket:', wsAiMessage);
          }
        }
        setLoading(false);
        return;
      }
      
      // For regular chat, send message to AI
      const res = await sendMessage({ 
        sessionId: sessionId, // Include sessionId in the object
        text: textToSend,
        model: selectedModel
        // systemPrompt is handled by the backend
      });

      // Generate a unique ID for the AI message
      const messageId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add AI response to UI using role/content
      const newAiMessage = {
        role: 'assistant', // Use role
        content: res.data.response, // Use content
        timestamp: res.data.timestamp, // Assuming backend sends timestamp
        messageId: messageId // Add message ID for reference
      };
      
      setMessages(prev => [...prev, newAiMessage]);
      
      // Broadcast AI response via WebSocket so other clients can see it
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        const wsMessage = {
          type: 'chat_message', // Use same message type for consistency
          text: res.data.response,
          chatId: sessionId,
          sender: 'ai', // Mark as AI message
          messageId: messageId
        };
        
        ws.current.send(JSON.stringify(wsMessage));
        console.log('AI response broadcast via WebSocket:', wsMessage);
      }

      // Call the callback prop to update the Dashboard state
      if (onNewAiResponse) {
        onNewAiResponse(newAiMessage.content);
      }

    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          'Failed to get response from AI';
      
      // Add error message using role/content structure
      setMessages(prev => [...prev, {
        role: 'assistant', // Treat errors as coming from the assistant/system
        content: `Error: ${errorMessage}`, // Use content
        timestamp: new Date().toISOString() // Add a timestamp
      }]);
      
      setError(errorMessage); // Keep setting the separate error state as well
    } finally {
      setLoading(false);
    }
  };

  // Function to save the system prompt
  const saveSystemPrompt = async () => {
    if (!sessionId || systemPrompt === savedSystemPrompt || isSavingPrompt) return;

    setIsSavingPrompt(true);
    setError(null); // Clear previous errors

    try {
      // Use imported updateSession function
      const res = await updateSession(sessionId, { systemPrompt }); 
      setSavedSystemPrompt(res.data.session.systemPrompt); // Update saved state
      console.log('System prompt updated successfully');
      // Optionally show a success message to the user
    } catch (err) {
      console.error('Failed to save system prompt:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to save prompt';
      setError(`Error saving prompt: ${errorMessage}`);
    } finally {
      setIsSavingPrompt(false);
    }
  };


  // Specific function to handle sending typed messages
  const sendTypedMessage = () => {
    const textToSend = input.trim();
    if (textToSend) {
      sendTextToServer(textToSend);
      setInput(''); // Clear input after sending typed message
    }
  };

  // Specific function to handle sending transcribed speech
  const sendTranscript = (transcript) => {
      if (transcript) {
          sendTextToServer(transcript);
          // Input is cleared within handleRecognitionResult for transcripts
      }
  };


  // Send typing status when user starts/stops typing
  const sendTypingStatus = (isTyping) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !sessionId || !user?._id) return;
    
    ws.current.send(JSON.stringify({
      type: 'typing_status',
      chatId: sessionId,
      userId: user._id,
      username: user?.name || user?.email || 'Anonymous',
      isTyping
    }));
    console.log(`Sent typing status: ${isTyping ? 'true' : 'false'}`);
  };
  
  // Handle input changes with debounced typing status
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInput(newValue);
    
    // Clear any previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Send typing status if user starts typing
    if (newValue && newValue !== input) {
      sendTypingStatus(true);
      
      // Set timeout to automatically clear typing status after inactivity
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 3000);
    } else if (!newValue) {
      // If input is cleared, immediately send stopped typing
      sendTypingStatus(false);
    }
  };

  const handleKeyPress = (e) => {
    // Send message on Enter key
    if (e.key === 'Enter' && !loading && input.trim()) {
      sendTypedMessage();
      // Send stopped typing status after sending message
      sendTypingStatus(false);
      
      // Clear any pending typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-lg p-2 overflow-auto "> {/* Responsive padding */}
      {/* Header Area */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center space-x-4"> {/* Container for status and clear button */}
          {/* Status Indicator */}
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${sessionId ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-300">{status}</span>
          </div>

          {/* Clear Global Chat Button */}
          {isGlobalChat && (
            <button
              onClick={handleClearGlobalChat}
              className="px-3 py-1 text-xs bg-red-700 hover:bg-red-800 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
              title="Clear all messages in global chat"
              disabled={loading}
            >
              Clear Chat
            </button>
          )}
        </div>
        
        {/* Model Selector Dropdown */}
        <div className="flex items-center space-x-2">
           <label htmlFor="model-select" className="text-sm text-gray-300">Model:</label>
           <select
             id="model-select"
             value={selectedModel}
             onChange={(e) => setSelectedModel(e.target.value)}
             className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5"
             disabled={loading} // Disable while processing
           >
             {availableModels.map(model => (
               <option key={model.id} value={model.id}>{model.name}</option>
             ))}
           </select>
        </div>
        
      </div>

      {/* System Prompt Input Area */}
      <div className="mb-3">
        {/* Make the label clickable */}
        <label
          htmlFor="system-prompt"
          className="flex items-center justify-between cursor-pointer hover:text-white transition-colors mb-1"
          onClick={() => setIsSystemPromptVisible(!isSystemPromptVisible)}
          title={isSystemPromptVisible ? "Hide System Prompt" : "Show System Prompt"}
        >
          <span className="text-sm font-medium text-gray-300"> {/* Wrap text for styling */}
            System Prompt (Optional):
          </span>
          {/* Arrow Icon for visual indication */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isSystemPromptVisible ? 'rotate-180' : 'rotate-0'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </label>
        {/* Conditionally render the textarea and save button */}
        {isSystemPromptVisible && (
          <>
            <textarea
              id="system-prompt"
              rows="2"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g., Act as a senior software engineer conducting a technical interview..."
              className="w-full p-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={loading || isSavingPrompt} // Disable while processing or saving prompt
            />
            {/* Save Prompt Button */}
            {sessionId && ( // Only show if session exists
              <button
                onClick={saveSystemPrompt}
                disabled={isSavingPrompt || systemPrompt === savedSystemPrompt || loading}
                className={`mt-1 px-3 py-1 text-xs rounded ${
                  isSavingPrompt || systemPrompt === savedSystemPrompt || loading
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800`}
              >
                {isSavingPrompt ? 'Saving...' : 'Save Prompt'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto pr-2 space-y-4" style={{ minHeight: '200px' }}> {/* Added min-height */}
        {error && (
          <div className="bg-red-900/30 text-red-200 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {/* Active Users Indicator */}
        {activeUsers.length > 0 && (
          <div className="bg-gray-900/50 text-gray-300 p-2 rounded-lg text-xs">
            <span className="font-medium">Active users: </span>
            {activeUsers.map((user, index) => (
              <span key={user.userId}>
                {user.username || "Anonymous"}
                {index < activeUsers.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}
        
        {/* Render messages using role and content */}
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`flex items-start ${message.role === 'user' ? 'justify-end' : 'justify-start'}`} // Use message.role
          >
            {message.role === 'assistant' && ( // Use message.role
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold mr-2">
                AI
              </div>
            )}
            
            <div className={`max-w-[90%] p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100 markdown-content'}`}> {/* Use message.role */}
              {/* Use message.content, check if it exists */}
              {message.role === 'assistant' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeText = String(children).replace(/\n$/, '');
                      const handleCopy = () => {
                        navigator.clipboard.writeText(codeText).then(() => {
                          setCopiedStates(prev => ({ ...prev, [node.position.start.offset]: true }));
                          setTimeout(() => {
                            setCopiedStates(prev => ({ ...prev, [node.position.start.offset]: false }));
                          }, 2000);
                        });
                      };

                      return !inline && match ? (
                        <div className="relative group">
                          <button
                            onClick={handleCopy}
                            title={copiedStates[node.position.start.offset] ? 'Copied!' : 'Copy code'}
                            className="absolute top-2.5 right-2.5 p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gray-500"
                          >
                            {copiedStates[node.position.start.offset] ? <CheckIcon /> : <CopyIcon />}
                          </button>
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            {...props}
                          >
                            {codeText}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.content || ''}
                </ReactMarkdown>
              ) : (
                <p className="whitespace-pre-wrap">{message.content || ''}</p>
              )}
              {message.timestamp && (
                <span className="text-xs text-gray-400 mt-1 block">
                  {new Date(message.timestamp).toLocaleTimeString()} {/* Keep timestamp logic */}
                </span>
              )}
            </div>
            
            {message.role === 'user' && (() => {
              let avatarText = 'USR';
              let userTitle = 'User';
              if (user && user.email) {
                userTitle = user.email;
                const emailPrefix = user.email.split('@')[0];
                if (emailPrefix && emailPrefix.length > 0) {
                  avatarText = emailPrefix.substring(0, 1).toUpperCase();
                } else {
                  // Fallback if email prefix is empty (e.g. email is "@domain.com")
                  avatarText = user.email.substring(0,1).toUpperCase() || 'U';
                }
              }
              return (
                <div 
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold ml-2"
                  title={userTitle} // Show full email on hover
                >
                  {avatarText}
                </div>
              );
            })()}
          </div>
        ))}
        
        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-start justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold mr-2">
              ...
            </div>
            <div className="max-w-[90%] p-3 rounded-lg bg-gray-700 text-gray-200">
              <div className="flex flex-col">
                <div className="flex space-x-1 mb-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <div className="text-xs text-gray-400">
                  {typingUsers.length === 1 
                    ? `${typingUsers[0].username} is typing...` 
                    : `${typingUsers.length} people are typing...`}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* AI is thinking indicator */}
        {loading && (
          <div className="flex items-start justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold mr-2">
              AI
            </div>
            <div className="max-w-[90%] p-3 rounded-lg bg-gray-700 text-gray-100">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="mt-4 flex items-center space-x-2">
        {/* Microphone Button */}
        {speechApiAvailable && (
            <button
                onClick={toggleRecording}
                className={`p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors ${
                    isRecording
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'bg-gray-600 hover:bg-gray-500 focus:ring-blue-500'
                }`}
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
                {/* Simple Mic Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isRecording ? 'text-white animate-pulse' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </button>
        )}
        {/* Text Input - Add ref */}
        <input
          ref={inputRef} // Assign the ref here
          type="text"
          value={input}
          onChange={handleInputChange} // Use handleInputChange to send typing status
          onKeyPress={handleKeyPress}
          placeholder={sessionId ? "Type your response..." : "Waiting for session..."}
          className={`flex-grow p-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
            loading || !sessionId ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={loading || !sessionId}
        />
        <button
          onClick={sendTypedMessage} // Use sendTypedMessage for the button click
          disabled={loading || !sessionId || !input.trim()}
          className={`flex-shrink-0 p-2.5 w-16 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
            loading || !sessionId || !input.trim()
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  );
}
