import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';

export default function Chat({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Connecting...');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash'); // Default model
  const messagesEndRef = useRef(null);

  // Define available models (can be fetched from API later if needed)
  const availableModels = [
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2 Pro' },
    { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro-exp-03-25', name: 'Gemini 2.5 Pro' },
    // Add other models as needed, e.g., 'gemini-pro'
  ];

  // Create new session on component mount
  useEffect(() => {
    const createSession = async () => {
      try {
        setStatus('Creating session...');
        const res = await api.post('/api/sessions', {});
        // Use the correct key from the server response
        setSessionId(res.data.sessionId);
        setStatus('Session active');
      } catch (err) {
        console.error('Session creation failed:', err);
        setError('Failed to create session. Please try again.');
        setStatus('Session failed');
      }
    };

    createSession();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !sessionId) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setError(null);

    // Add user message to UI
    setMessages(prev => [...prev, {
      from: 'user',
      text: userMessage,
      timestamp: new Date().toISOString()
    }]);

    try {
      // Send message to backend, including the selected model
      const res = await api.post('/api/chat', {
        text: userMessage,
        sessionId,
        model: selectedModel // Include selected model
      });

      // Add AI response to UI
      setMessages(prev => [...prev, {
        from: 'ai',
        text: res.data.response,
        timestamp: res.data.timestamp
      }]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          'Failed to get response from AI';
      
      setMessages(prev => [...prev, {
        from: 'ai',
        text: `Error: ${errorMessage}`
      }]);
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-lg p-4">
      {/* Header Area */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white">Interview Assistant</h2>
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
        {/* Status Indicator */}
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${sessionId ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-300">{status}</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {error && (
          <div className="bg-red-900/30 text-red-200 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`flex items-start ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.from === 'ai' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold mr-2">
                AI
              </div>
            )}
            
            <div className={`max-w-xs p-3 rounded-lg ${message.from === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
              <p className="whitespace-pre-wrap">{message.text}</p>
              {message.timestamp && (
                <span className="text-xs text-gray-400 mt-1 block">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            
            {message.from === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold ml-2">
                You
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
        <input
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
          onClick={sendMessage}
          disabled={loading || !sessionId || !input.trim()}
          className={`flex-shrink-0 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
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
              Processing...
            </span>
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  );
}
