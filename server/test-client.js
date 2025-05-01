import WebSocket from 'ws';

const CLIENT_ID = `Client-${Math.random().toString(36).substr(2, 9)}`;
const socket = new WebSocket('ws://localhost:5001');

const formatLog = (type, message) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${CLIENT_ID}] ${type}: ${message}`;
};

console.log(formatLog('INFO', 'Initializing WebSocket connection...'));

socket.on('open', () => {
  const timestamp = new Date().toISOString();
  console.log(formatLog('CONNECT', `Connected to server at ${timestamp}`));
  console.log(formatLog('SEND', 'Sending initial message'));
  
  const initMessage = {
    type: 'client_init',
    clientId: CLIENT_ID,
    timestamp,
    data: 'Hello from client!'
  };
  
  socket.send(JSON.stringify(initMessage));
});

socket.on('message', (message) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(formatLog('RECV', `Raw message: ${message.toString()}`));
    
    const response = JSON.parse(message.toString());
    console.log(formatLog('DATA', `Processed message: ${JSON.stringify(response)}`));
    
    if (response.type === 'response') {
      console.log(formatLog('RESPONSE', `Server response: ${response.data}`));
    }
  } catch (error) {
    console.error(formatLog('ERROR', `Message parsing failed: ${error.message}`));
    console.error('Error stack:', error.stack);
  }
});

socket.on('close', (code, reason) => {
  const timestamp = new Date().toISOString();
  console.log(formatLog('DISCONNECT', `Connection closed. Code: ${code}, Reason: ${reason.toString()}`));
  console.log(formatLog('STATUS', `Connection duration: ${new Date().getTime() - Date.parse(timestamp)}ms`));
});

socket.on('error', (error) => {
  const timestamp = new Date().toISOString();
  console.error(formatLog('ERROR', `Client error: ${error.message}`));
  console.error('Error stack:', error.stack);
});
