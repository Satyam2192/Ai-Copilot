import axios from 'axios'; // Import axios
import Session from '../models/Session.js';
import Question from '../models/Question.js';

// Remove GoogleGenAI initialization
// const ai = new GoogleGenAI({ apiKey: process.env.API_Key });

const formatLog = (level, module, message, metadata = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    module,
    message,
    ...metadata
  };

  const formatted = `[${timestamp}] [${level}] [CHAT] ${message}`;
  if (level === 'ERROR') {
    console.error(formatted, metadata);
  } else if (level === 'WARN') {
    console.warn(formatted, metadata);
  } else {
    console.log(formatted, metadata);
  }

  return logEntry;
};

export async function handleChatMessage(req, res) {
  try {
    // Destructure request body - remove systemPrompt from here
    const { text, sessionId, questionId, model = 'gemini-1.5-flash' } = req.body;
    const userId = req.user.id;
    const apiKey = process.env.API_Key;

    formatLog('INFO', 'handleChatMessage', 'Processing chat message', {
      userId,
      sessionId,
      questionId,
      model,
      hasText: !!text
    });

    if (!text) {
      formatLog('WARN', 'handleChatMessage', 'Empty message received', { userId });
      return res.status(400).json({
        error: 'Message text is required',
        code: 'MISSING_TEXT'
      });
    }
    if (!apiKey) {
        formatLog('ERROR', 'handleChatMessage', 'API Key is missing in server environment', { userId });
        return res.status(500).json({
          error: 'Server configuration error: API Key missing',
          code: 'MISSING_API_KEY'
      });
    }

    let session = null;
    let sessionSystemPrompt = ''; // Default to empty

    // Fetch session and store user message
    if (sessionId) {
      session = await Session.findByIdAndUpdate(
        sessionId,
        {
          $push: {
            messages: {
              role: 'user',
              content: text,
              timestamp: new Date()
            }
          },
          $set: { lastActive: new Date() }
        },
        { new: true } // Return the updated document to get the prompt easily
      ).lean(); // Use lean for performance if only reading prompt

      if (session) {
        sessionSystemPrompt = session.systemPrompt || ''; // Get prompt from fetched session
        formatLog('INFO', 'handleChatMessage', 'Fetched session system prompt', { sessionId, hasSystemPrompt: !!sessionSystemPrompt });
      } else {
        formatLog('WARN', 'handleChatMessage', 'Session not found for storing message or getting prompt', { sessionId });
        // Decide if this is an error or if chat can proceed without session context
      }
    } else {
       formatLog('INFO', 'handleChatMessage', 'No sessionId provided, proceeding without session context.', { userId });
    }


    // --- Use Axios to call Google API ---
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Prepend system prompt (from session) to user text if available
    const combinedText = sessionSystemPrompt ? `${sessionSystemPrompt}\n\n---\n\nUser: ${text}` : text;

    const requestBody = {
      contents: [{
        // Role might not be strictly necessary for this endpoint, but parts is key
        parts: [{ text: combinedText }] // Send combined text
      }]
      // Add generationConfig here if needed
      // generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
    };

    formatLog('INFO', 'handleChatMessage', 'Calling Google API via Axios', {
      url: apiUrl.replace(apiKey, '***'), // Mask API key in logs
      model: model,
      payloadContents: requestBody.contents
    });

    let apiResponse;
    try {
        apiResponse = await axios.post(apiUrl, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (axiosError) {
        formatLog('ERROR', 'handleChatMessage', 'Google API Axios request failed', {
            status: axiosError.response?.status,
            data: axiosError.response?.data,
            message: axiosError.message
        });
        return res.status(axiosError.response?.status || 502).json({
            error: 'AI service request failed',
            code: 'AI_SERVICE_REQUEST_FAILED',
            details: axiosError.response?.data || axiosError.message
        });
    }


    // Handle API errors indicated in the response data
    if (!apiResponse.data || !apiResponse.data.candidates || apiResponse.data.candidates.length === 0) {
       formatLog('ERROR', 'handleChatMessage', 'Google API error or empty response', {
         status: apiResponse.status,
         data: apiResponse.data // Log the actual response data
       });
       return res.status(502).json({
         error: 'AI service error or empty response',
         code: 'AI_SERVICE_ERROR',
         details: apiResponse.data?.promptFeedback || 'No candidates returned'
       });
    }

    // Extract response text from the correct structure
    const aiResponseText = apiResponse.data.candidates[0]?.content?.parts?.[0]?.text;

    // Check if text extraction failed
    if (!aiResponseText) {
      formatLog('ERROR', 'handleChatMessage', 'Invalid response structure or missing text', {
        rawResponseData: apiResponse.data // Log the full response data
      });
      return res.status(500).json({
        error: 'Invalid AI response structure',
        code: 'INVALID_RESPONSE_STRUCTURE'
      });
    }

    formatLog('INFO', 'handleChatMessage', 'AI response received', {
      responseLength: aiResponseText.length
    });

    // Store AI response in session (check if session exists again, though it should if we updated it earlier)
    if (sessionId && session) { // Ensure session object exists
      await Session.findByIdAndUpdate(
        sessionId,
        {
          $push: {
            messages: {
              role: 'assistant',
              content: aiResponseText,
              timestamp: new Date()
            }
          },
          $inc: { interactionCount: 1 },
          $set: { lastActive: new Date() }
        }
      );
    }

    // Update question statistics if questionId is provided
    if (questionId) {
      await Question.findByIdAndUpdate(
        questionId,
        {
          $inc: {
            totalResponses: 1,
            averageResponseTime: 1 // Placeholder for actual timing logic
          },
          $push: {
            recentResponses: {
              userId,
              response: aiResponseText,
              timestamp: new Date()
            }
          }
        }
      );
    }

    res.json({
      response: aiResponseText,
      timestamp: new Date().toISOString(),
      sessionId,
      questionId
    });

  } catch (error) {
    // Catch any other unexpected errors during processing
    formatLog('ERROR', 'handleChatMessage', 'Critical error in chat processing', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
}
