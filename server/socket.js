import { WebSocketServer } from 'ws'; // Standard import

export const initWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server });
  
  // The 'ws' library defines WebSocket.OPEN as 1, WebSocket.CLOSING as 2, etc.
  // We can use the numeric value directly for client.readyState checks.
  const WEBSOCKET_STATE_OPEN = 1;

  console.log(`WebSocket server initialized on port ${process.env.PORT || 5000}`);

  // Store active clients with their metadata
  const clients = new Map();

  // Broadcast to clients in a specific chat
  const broadcastToChat = (chatId, message, excludeSocket = null) => {
    const timestamp = new Date().toISOString();
    let broadcastCount = 0;
    const intendedRecipients = [];
    const notSentReasons = [];

    wss.clients.forEach((client) => {
      const clientIdentifier = `User ${client.userId || 'N/A'} in Chat ${client.chatId || 'N/A'} (State: ${client.readyState})`;
      const isReady = client.readyState === WEBSOCKET_STATE_OPEN; // Check against numeric value 1
      const isCorrectChat = client.chatId === chatId; // Crucial check
      const isExcluded = excludeSocket && client === excludeSocket;

      // Add detailed log for debugging readyState
      if (client.chatId === chatId) {
          console.log(`[DEBUG] Checking client ${client.userId || 'N/A'} for chat "${chatId}": readyState=${client.readyState}, ExpectedOPEN=${WEBSOCKET_STATE_OPEN}, isReady=${isReady}, isCorrectChat=${isCorrectChat}, isExcluded=${isExcluded}`);
      }

      if (isReady && isCorrectChat && !isExcluded) {
        try {
          client.send(JSON.stringify(message));
          broadcastCount++;
          intendedRecipients.push(`${clientIdentifier} (Sent)`);
        } catch (sendError) {
          console.error(`[${timestamp}] Broadcasting Error: Failed to send to ${clientIdentifier} in chat ${chatId}:`, sendError.message);
          notSentReasons.push(`${clientIdentifier}: SendError - ${sendError.message}`);
        }
      } else {
        let reason = "";
        if (!isReady) reason += "NotReady ";
        if (!isCorrectChat) reason += `WrongChat (Expected: ${chatId}, Actual: ${client.chatId || 'None'}) `;
        if (isExcluded) reason += "ExcludedSender ";
        if (reason) {
          notSentReasons.push(`${clientIdentifier}: ${reason.trim()}`);
        }
      }
    });

    console.log(`[${timestamp}] Broadcast to chat "${chatId}": Attempted to send to ${broadcastCount} client(s). Excluded sender: ${excludeSocket ? 'yes' : 'no'}`);
    if (notSentReasons.length > 0) {
      console.log(`[${timestamp}] Broadcast Info for chat "${chatId}": Could not send to some clients:`);
      notSentReasons.forEach(reason => console.log(`  - ${reason}`));
    }
    if (broadcastCount > 0) {
        console.log(`[${timestamp}] Broadcast Info for chat "${chatId}": Successfully sent to:`, intendedRecipients);
    }
    
    return broadcastCount;
  };

  // Handle new connections
  wss.on('connection', (socket, req) => {
    const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] New client connected (IP: ${clientIp}). Total clients now: ${wss.clients.size}`);
    
    // Initialize socket properties
    socket.chatId = null;
    socket.userId = null;
    socket.username = null;
    socket.isAlive = true; // For heartbeat

    socket.on('pong', () => {
      socket.isAlive = true;
      // console.log(`[PONG] from ${socket.userId || 'unknown client'}`); // Verbose, but useful for debugging
    });
    
    // Handle incoming messages
    socket.on('message', (message) => {
      try {
        const timestamp = new Date().toISOString();
        const data = JSON.parse(message.toString());
        console.log(`[${timestamp}] Parsed message:`, data);

        // Handle different message types
        switch (data.type) {
          case 'join_chat':
            // User joins a chat
            if (data.chatId) {
              // Update socket properties
              socket.chatId = data.chatId;
              socket.userId = data.userId || socket.userId;
              socket.username = data.username || socket.username;
              
              console.log(`[${timestamp}] Client joined chatId: ${socket.chatId}. User: ${socket.userId || 'unknown'}. Total clients: ${wss.clients.size}`);
              
              // Store client metadata
              clients.set(socket, {
                chatId: socket.chatId,
                userId: socket.userId,
                username: socket.username,
                joinedAt: new Date()
              });
              
              // Send confirmation to the client
              socket.send(JSON.stringify({
                type: 'join_success',
                chatId: socket.chatId,
                timestamp
              }));
              
              console.log(`[${timestamp}] Socket state at join for ${socket.userId} in chat ${socket.chatId}: ${socket.readyState}`);

              // Notify other clients in the chat that someone joined
              // Adding a small delay to allow socket state to stabilize potentially
              setTimeout(() => {
                const currentActiveUsers = [...clients.values()]
                  .filter(client => client.chatId === data.chatId && client.userId) // Ensure userId is present
                  .map(client => ({
                    userId: client.userId,
                    username: client.username
                  }));

                broadcastToChat(data.chatId, {
                  type: 'user_joined',
                  chatId: data.chatId,
                  userId: socket.userId,
                  username: socket.username,
                  timestamp: new Date().toISOString(), // Use fresh timestamp
                  activeUsers: currentActiveUsers
                }, socket);
              }, 200); // 200ms delay
            }
            break;
            
          case 'chat_message':
            // User sends a message
            if (data.chatId && data.text && data.sender) { // Ensure sender is present
              // Set chat ID if not already set (implicit join)
              if (!socket.chatId || socket.chatId !== data.chatId) {
                socket.chatId = data.chatId;
                socket.userId = data.sender; // Assign sender as userId if joining implicitly
                socket.username = data.username || 'Anonymous'; // Assign username if available

                console.log(`[${timestamp}] Client implicitly associated/updated chatId to: ${socket.chatId} (User: ${socket.userId}, Username: ${socket.username}) via chat_message. Total clients: ${wss.clients.size}`);
                
                // Update stored metadata
                clients.set(socket, {
                  chatId: socket.chatId,
                  userId: socket.userId,
                  username: socket.username,
                  joinedAt: clients.get(socket)?.joinedAt || new Date() // Preserve original join time if exists
                });
              }
              
              // Create message to broadcast
              const messageId = data.messageId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const messageToBroadcast = { // Renamed to avoid conflict with outer 'message'
                type: 'new_message',
                timestamp,
                content: data.text,
                chatId: data.chatId,
                sender: data.sender, // This is the original sender's ID
                username: clients.get(socket)?.username || data.username || 'Anonymous', // Get sender's username
                messageId: messageId
              };
              
              // Log all clients in this chat for debugging
              const clientsInChat = Array.from(wss.clients)
                .filter(client => client.chatId === data.chatId)
                .map(client => ({
                  userId: client.userId || 'unknown',
                  username: client.username || 'unnamed',
                  readyState: client.readyState,
                  isCurrentSender: client === socket
                }));
                
              console.log(`[${timestamp}] Broadcasting chat_message for chatId: "${data.chatId}". Sender: ${data.sender}. Message: "${data.text}"`);
              console.log(`[${timestamp}] Clients in this chat ("${data.chatId}"):`, JSON.stringify(clientsInChat, null, 2));
              
              // Send to ALL clients in the chat, including the sender (client handles not re-displaying its own message if needed, or use messageId)
              broadcastToChat(data.chatId, messageToBroadcast);
            } else {
              console.log(`[${timestamp}] chat_message ignored due to missing chatId, text, or sender:`, data);
            }
            break;
            
          case 'typing_status':
            // User is typing
            if (data.chatId && data.userId) {
              const typingMessage = {
                type: 'typing_status',
                chatId: data.chatId,
                userId: data.userId,
                username: data.username || socket.username,
                isTyping: data.isTyping === true,
                timestamp 
              };
              
              // Broadcast typing status to all clients except the sender
              broadcastToChat(data.chatId, typingMessage, socket);
            }
            break;
            
          case 'message_read':
            // User read a message
            if (data.chatId && data.messageId && data.userId) {
              const readMessage = {
                type: 'message_read',
                chatId: data.chatId,
                messageId: data.messageId,
                userId: data.userId,
                timestamp
              };
              
              // Broadcast read status to all clients in the chat
              broadcastToChat(data.chatId, readMessage);
            }
            break;
            
          case 'user_info_update':
            // User updated their profile info
            if (data.userId) {
              // Update socket properties
              socket.userId = data.userId;
              socket.username = data.username || socket.username;
              
              // Update stored metadata
              clients.set(socket, {
                ...clients.get(socket),
                userId: socket.userId,
                username: socket.username
              });
              
              // If in a chat, broadcast user info update to other clients
              if (socket.chatId) {
                const updateMessage = {
                  type: 'user_info_update',
                  chatId: socket.chatId,
                  userId: data.userId,
                  username: socket.username,
                  timestamp
                };
                
                broadcastToChat(socket.chatId, updateMessage, socket);
              }
            }
            break;

          case 'broadcast_clear_chat':
            if (data.chatId === 'global' && socket.chatId === 'global') {
              console.log(`[${timestamp}] Received broadcast_clear_chat for global chat from ${socket.userId}`);
              broadcastToChat('global', {
                type: 'global_chat_cleared',
                chatId: 'global',
                clearedBy: socket.userId, // User who initiated the clear
                timestamp: new Date().toISOString()
              }, socket); // Exclude the sender from this specific broadcast, they update their UI locally
            }
            break;
            
          default:
            console.log(`[${timestamp}] Received unhandled message type or malformed message:`, data);
        }
      } catch (error) {
        console.error('[ERROR] Message processing failed:', error.message);
        console.error('Error stack:', error.stack);
      }
    });

    // Handle disconnections
    socket.on('close', (code, reason) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Client disconnected. Code: ${code}, Reason: ${reason.toString()}`);
      
      // Get client data before removal
      const clientData = clients.get(socket);
      const chatId = socket.chatId;
      const userId = socket.userId;
      
      // Remove from clients map
      clients.delete(socket);
      
      // Notify others if the client was in a chat
      if (chatId && userId) {
        const disconnectMessage = {
          type: 'user_left',
          chatId,
          userId,
          username: socket.username,
          timestamp,
          activeUsers: [...clients.values()]
            .filter(client => client.chatId === chatId)
            .map(client => ({
              userId: client.userId,
              username: client.username
            }))
        };
        
        broadcastToChat(chatId, disconnectMessage);
      }
      
      console.log(`[${timestamp}] Remaining clients: ${wss.clients.size}`);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] Socket error:`, error.message);
      console.error('Error stack:', error.stack);
    });
  });
  
  // Server-level error handler
  wss.on('error', (error) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] WebSocket server error:`, error.message);
    console.error('Error stack:', error.stack);
  });

  // Heartbeat to keep connections alive and detect stale connections
  const interval = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (socket.isAlive === false) {
        clients.delete(socket);
        return socket.terminate();
      }
      
      socket.isAlive = false;
      socket.ping(() => {});
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
};
