import { WebSocketServer } from 'ws';

export const initWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server });
  
  console.log(`WebSocket server initialized on port ${process.env.PORT || 5000}`);

  wss.on('connection', (socket) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] New client connected. Total clients: ${wss.clients.size}`);
    
    socket.on('message', (message) => {
      try {
        const timestamp = new Date().toISOString();
        const data = JSON.parse(message.toString());
        console.log(`[${timestamp}] Raw message received: ${message.toString()}`);
        console.log(`[${timestamp}] Parsed message:`, data);
        
        // Broadcast message to all clients
        const response = {
          type: 'response',
          timestamp,
          data: data.text,
          clientCount: wss.clients.size
        };
        
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocketServer.OPEN) {
            client.send(JSON.stringify(response));
            console.log(`[${timestamp}] Message broadcasted to ${wss.clients.size} clients`);
          }
        });
      } catch (error) {
        console.error('[ERROR] Message processing failed:', error.message);
        console.error('Error stack:', error.stack);
      }
    });

    socket.on('close', (code, reason) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Client disconnected. Code: ${code}, Reason: ${reason.toString()}`);
      console.log(`[${timestamp}] Remaining clients: ${wss.clients.size}`);
    });
    
    socket.on('error', (error) => {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] Socket error:`, error.message);
      console.error('Error stack:', error.stack);
    });
  });
  
  wss.on('error', (error) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] WebSocket server error:`, error.message);
    console.error('Error stack:', error.stack);
  });

  return wss;
};
