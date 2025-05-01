import React, { useState, useRef, useEffect, useCallback } from 'react';
// Import specific API functions
import { getSession, startSession, sendMessage, updateSession } from '../services/api'; 

// Check for SpeechRecognition API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.continuous = true; // Keep listening even after pauses
  recognition.interimResults = true; // Get results while speaking
  recognition.lang = 'en-US'; // Set language
}

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
  const recognitionRef = useRef(recognition);
  const isManuallyStoppingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); // Ref for the chat input element

  // Define available models
  const availableModels = [
    { id: 'gemini-2.0-flash-001', name: 'Gemini 2 Flash' },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2 Pro' },
    { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro-exp-03-25', name: 'Gemini 2.5 Pro' },
    // Add other models as needed, e.g., 'gemini-pro'
  ];

  // Load existing session or create new one on mount
  useEffect(() => {
    const initializeSession = async () => {
      setError(null); // Clear previous errors
      if (initialSessionId) {
        // --- Load Existing Session ---
        try {
          setStatus(`Loading session ${initialSessionId}...`);
          setLoading(true); // Indicate loading state
          // Use imported getSession function
          const res = await getSession(initialSessionId); 
          const sessionData = res.data;

          setMessages(sessionData.messages || []);
          setSessionId(sessionData._id);
          setSystemPrompt(sessionData.systemPrompt || '');
          setSavedSystemPrompt(sessionData.systemPrompt || '');
          // Optionally set topic if needed: setTopic(sessionData.topic);
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
    // Dependency array: initialSessionId ensures this runs if the target session changes.
    // systemPrompt is NOT included here, as we only want to use the *initial* prompt
    // value when creating a session, not re-run this effect every time the prompt input changes.
  }, [initialSessionId]);


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
    console.error('Speech recognition error:', event.error);
    setError(`Speech recognition error: ${event.error}`);
    setIsRecording(false); // Stop recording state on error
  }, []); // No dependencies needed

  // End handler with restart logic for continuous listening
  const handleRecognitionEnd = useCallback(() => {
    console.log('Speech recognition ended.');

    // Check if the stop was triggered manually by the user
    if (isManuallyStoppingRef.current) {
        console.log('Manual stop detected, not restarting.');
        isManuallyStoppingRef.current = false; // Reset the ref
        // isRecording was already set to false in toggleRecording
        return; // Don't proceed to restart logic
    }

    // If not a manual stop, and we still intend to record, restart it.
    // Check isRecording state *before* potentially setting it false.
    if (isRecording && recognitionRef.current) {
        console.log('Unexpected end, attempting to restart recognition...');
        try {
            recognitionRef.current.start();
            // Keep isRecording as true
        } catch(e) {
            console.error("Error restarting recognition:", e);
            setIsRecording(false); // Stop if restart fails
        }
    } else {
        // If it ended naturally and we didn't intend to record anymore,
        // or if an error occurred (handled by onError), ensure state is false.
        // This case might not be strictly necessary if onError always fires first,
        // but it's safer to ensure the state is correct.
        console.log('Recognition ended naturally or after error, ensuring isRecording is false.');
        setIsRecording(false);
    }
  }, [isRecording]); // isRecording is needed to check if restart is intended

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
      console.log('Starting recognition...');
      setError(null); // Clear previous errors
      try {
          recognitionRef.current.start();
          setIsRecording(true);
      } catch(e) {
          console.error("Error starting recognition:", e);
          setError("Failed to start microphone. Check permissions.");
          setIsRecording(false);
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
    setMessages(prev => [...prev, {
      role: 'user', // Use role
      content: textToSend, // Use content
      timestamp: new Date().toISOString()
    }]);

    try {
      // Send message to backend using imported sendMessage function
      // Pass a single object containing sessionId, text, and model
      const res = await sendMessage({ 
        sessionId: sessionId, // Include sessionId in the object
        text: textToSend,
        model: selectedModel
        // systemPrompt is handled by the backend
      });

      // Add AI response to UI using role/content
      const newAiMessage = {
        role: 'assistant', // Use role
        content: res.data.response, // Use content
        timestamp: res.data.timestamp // Assuming backend sends timestamp
      };
      setMessages(prev => [...prev, newAiMessage]);

      // Call the callback prop to update the Dashboard state
      if (onNewAiResponse) {
        onNewAiResponse(newAiMessage.text);
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


  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) { // Prevent sending while loading
      sendTypedMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-lg p-2 overflow-auto "> {/* Responsive padding */}
      {/* Header Area */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        {/* Status Indicator */}
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${sessionId ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-300">{status}</span>
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
            
            <div className={`max-w-xs p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}> {/* Use message.role */}
              {/* Use message.content, check if it exists */}
              <p className="whitespace-pre-wrap">{message.content || ''}</p> 
              {message.timestamp && (
                <span className="text-xs text-gray-400 mt-1 block">
                  {new Date(message.timestamp).toLocaleTimeString()} {/* Keep timestamp logic */}
                </span>
              )}
            </div>
            
            {message.role === 'user' && ( // Use message.role
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold ml-2">
                You {/* Keep 'You' label */}
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex items-start justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold mr-2">
              AI
            </div>
            <div className="max-w-xs p-3 rounded-lg bg-gray-700 text-gray-100">
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
          onChange={(e) => setInput(e.target.value)}
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
