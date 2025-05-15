import CommonChat from '../models/CommonChat.js';
import axios from 'axios'; // Import axios

// Get the global chat room (create if not exists)
export async function getGlobalChat(req, res) {
  try {
    const userId = req.user.id;
    const userName = req.user.name || req.user.email || 'Anonymous';

    // Find or create the global chat
    let globalChat = await CommonChat.findOne({ isGlobal: true });
    
    if (!globalChat) {
      // Create the global chat if it doesn't exist
      globalChat = await CommonChat.create({
        name: 'Global Chat',
        description: 'Chat room for all users',
        isGlobal: true,
        messages: [{
          role: 'system',
          content: 'Welcome to the global chat room! Connect with other users here.',
          timestamp: new Date()
        }]
      });
    }

    // Return the global chat data
    res.json({
      success: true,
      chatId: globalChat._id,
      name: globalChat.name,
      description: globalChat.description,
      messages: globalChat.messages
    });
  } catch (error) {
    console.error('Error fetching global chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch global chat',
      message: error.message
    });
  }
}

// Clear all messages from the global chat
export async function clearGlobalChat(req, res) {
  try {
    const globalChat = await CommonChat.findOne({ isGlobal: true });

    if (!globalChat) {
      return res.status(404).json({
        success: false,
        error: 'Global chat not found'
      });
    }

    globalChat.messages = [{
        role: 'system',
        content: 'Global chat has been cleared by an administrator.', // Or by the user if not admin-restricted
        timestamp: new Date()
    }];
    // Optionally, also clear activeUsers if desired, or just messages
    // globalChat.activeUsers = []; 
    globalChat.lastActive = new Date();
    await globalChat.save();

    // TODO: Broadcast this event via WebSocket to all connected clients in global chat
    // This will be handled in socket.js by sending a specific message type after this API call succeeds.

    res.json({
      success: true,
      message: 'Global chat cleared successfully.'
    });

  } catch (error) {
    console.error('Error clearing global chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear global chat',
      message: error.message
    });
  }
}

// Add a message to the common chat
export async function sendCommonChatMessage(req, res) {
  try {
    const { content } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || req.user.email || 'Anonymous';
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // Find the global chat
    const globalChat = await CommonChat.findOne({ isGlobal: true });
    
    if (!globalChat) {
      return res.status(404).json({
        success: false,
        error: 'Global chat not found'
      });
    }

    // Add the message
    const newMessage = {
      role: 'user',
      content,
      sender: {
        userId,
        name: userName
      },
      timestamp: new Date()
    };

    globalChat.messages.push(newMessage);
    globalChat.lastActive = new Date();
    
    // Update active users
    const userExists = globalChat.activeUsers.some(
      user => user.userId.toString() === userId.toString()
    );
    
    if (!userExists) {
      globalChat.activeUsers.push({
        userId,
        name: userName,
        lastActive: new Date()
      });
    } else {
      // Update user's last active time
      await CommonChat.updateOne(
        { 
          _id: globalChat._id,
          'activeUsers.userId': userId 
        },
        { 
          $set: { 'activeUsers.$.lastActive': new Date() } 
        }
      );
    }
    
    await globalChat.save(); // User message saved

    // Now, get AI response
    const apiKey = process.env.API_Key;
    const model = 'gemini-1.5-flash'; // Or make configurable
    let aiResponseText = "I'm sorry, I couldn't process that."; // Default AI response

    if (!apiKey) {
      console.error('Error in sendCommonChatMessage: API Key is missing for AI call.');
      // Don't fail the whole request, just skip AI response
    } else {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const aiRequestBody = {
          contents: [{ parts: [{ text: content }] }] // 'content' is the user's message text
        };
        
        console.log(`[AI Global] Calling Google API: ${apiUrl.replace(apiKey, '***')}`);
        const apiResponse = await axios.post(apiUrl, aiRequestBody, { headers: { 'Content-Type': 'application/json' } });

        if (apiResponse.data && apiResponse.data.candidates && apiResponse.data.candidates.length > 0 &&
            apiResponse.data.candidates[0]?.content?.parts?.[0]?.text) {
          aiResponseText = apiResponse.data.candidates[0].content.parts[0].text;
          console.log('[AI Global] Response received:', aiResponseText.substring(0, 50) + '...');
        } else {
          console.error('[AI Global] Error or empty/invalid response from Google API:', apiResponse.data);
        }
      } catch (aiError) {
        console.error('[AI Global] Axios request to Google API failed:', aiError.message);
        if (aiError.response) {
          console.error('[AI Global] AI Error Response Data:', aiError.response.data);
        }
      }
    }

    // Save AI response to CommonChat
    const aiMessage = {
      role: 'assistant',
      content: aiResponseText,
      sender: { userId: null, name: 'Global Assistant' },
      timestamp: new Date()
    };
    globalChat.messages.push(aiMessage);
    globalChat.lastActive = new Date(); // Update last active time again
    await globalChat.save();

    // The client that called this API will receive both messages.
    // It will then send the aiMessage via WebSocket for other clients.
    res.json({
      success: true,
      userMessage: newMessage, // The user's message that was saved
      aiMessage: aiMessage     // The AI's response
    });

  } catch (error) {
    console.error('Error sending message to global chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      message: error.message
    });
  }
}

// Mark user as active in global chat
export async function joinGlobalChat(req, res) {
  try {
    const userId = req.user.id;
    const userName = req.user.name || req.user.email || 'Anonymous';

    // Find the global chat
    let globalChat = await CommonChat.findOne({ isGlobal: true });
    
    if (!globalChat) {
      // Create the global chat if it doesn't exist
      globalChat = await CommonChat.create({
        name: 'Global Chat',
        description: 'Chat room for all users',
        isGlobal: true,
        messages: [{
          role: 'system',
          content: 'Welcome to the global chat room! Connect with other users here.',
          timestamp: new Date()
        }]
      });
    }

    // Add user to active users if not already there
    const userExists = globalChat.activeUsers.some(
      user => user.userId.toString() === userId.toString()
    );
    
    if (!userExists) {
      globalChat.activeUsers.push({
        userId,
        name: userName,
        lastActive: new Date()
      });
      await globalChat.save();
    } else {
      // Update user's last active time
      await CommonChat.updateOne(
        { 
          _id: globalChat._id,
          'activeUsers.userId': userId 
        },
        { 
          $set: { 'activeUsers.$.lastActive': new Date(), 'activeUsers.$.name': userName } 
        }
      );
    }

    res.json({
      success: true,
      chatId: globalChat._id,
      name: globalChat.name,
      activeUsers: globalChat.activeUsers
    });
  } catch (error) {
    console.error('Error joining global chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join global chat',
      message: error.message
    });
  }
}

// Leave the global chat (mark user as inactive)
export async function leaveGlobalChat(req, res) {
  try {
    const userId = req.user.id;

    // Remove user from active users list
    await CommonChat.updateOne(
      { isGlobal: true },
      { $pull: { activeUsers: { userId } } }
    );

    res.json({
      success: true,
      message: 'Successfully left global chat'
    });
  } catch (error) {
    console.error('Error leaving global chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to leave global chat',
      message: error.message
    });
  }
}
