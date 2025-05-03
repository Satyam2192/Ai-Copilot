# Server Documentation

## Overview
The server is a Node.js application built with Express and MongoDB, providing REST APIs and WebSocket functionality for a chat application. It includes authentication, session management, question handling, and real-time chat features.

## Architecture
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **WebSocket**: Socket.IO
- **Authentication**: JWT with cookie-based sessions
- **Environment**: Dockerized with docker-compose

## Getting Started
### Prerequisites
- Node.js 18+
- MongoDB instance
- Docker (for containerized deployment)

### Installation
```bash
cd server
npm install
cp .env.example .env  # Update with your credentials
npm run dev
```

## API Endpoints
### Authentication (`/api/auth`)
All authentication endpoints set JWT tokens in both httpOnly cookies and `x-auth-token` headers for client flexibility.

- `POST /register`  
  **Request Body:** `{ email: string, password: string }`  
  **Responses:**  
  - 200: `{ user: { email, createdAt } }`  
  - 400: "Email already exists" | "Email and password are required"  
  - 500: "Registration failed"

- `POST /login`  
  **Request Body:** `{ email: string, password: string }`  
  **Responses:**  
  - 200: `{ user: { email, lastLogin } }`  
  - 401: "Invalid credentials"  
  - 500: "Login failed"

- `POST /logout`  
  **Behavior:** Clears auth cookie  
  **Responses:**  
  - 200: `{ message: "Logged out successfully" }`

- `GET /me`  
  **Auth Required:** Yes (via middleware)  
  **Responses:**  
  - 200: `{ user: { email, id, lastAccess } }`  
  - 401: "Unauthorized"  
  - 500: "Failed to fetch user profile"

### Sessions (`/api/sessions`)
Requires authentication via JWT cookie/header.

- `GET /`  
  **Query Params:** `topic` (regex filter), `limit` (default 50)  
  **Response:** Array of sessions with fields: `_id, topic, startTime, lastActive, interactionCount, systemPrompt`  
  **Error Codes:** 500

- `POST /`  
  **Request Body:** `{ topic?: string, systemPrompt?: string }`  
  **Response:**  
  ```json
  {
    "sessionId": "ObjectId",
    "startTime": "ISO Date",
    "topic": "string",
    "systemPrompt": "string",
    "userId": "ObjectId"
  }
  ```

- `GET /:id`  
  **Response:** Full session details including metadata  
  **Error Codes:** 404, 403 (wrong user), 500

- `DELETE /:id`  
  **Behavior:** Soft delete (mark as ended)  
  **Response:** `{ message: "Session deleted successfully" }`  
  **Error Codes:** 404, 403, 500

### Questions (`/api/questions`)
Requires authentication and admin privileges for POST/PUT/DELETE.

- `GET /`  
  **Query Params:** `tag` (filter by tag), `limit` (default 20), `sort` (field: `createdAt`, order: `desc`)  
  **Response:** Array of questions with fields: `_id, text, author, tags, createdAt`  
  **Error Codes:** 500

- `POST /`  
  **Request Body:** `{ text: string, tags?: string[] }`  
  **Response:**  
  ```json
  {
    "questionId": "ObjectId",
    "text": "string",
    "tags": ["string"],
    "author": "ObjectId",
    "createdAt": "ISO Date"
  }
  ```  
  **Error Codes:** 400 (missing text), 401, 403 (not admin), 500

- `PUT /:id`  
  **Request Body:** `{ text?: string, tags?: string[] }`  
  **Response:** Updated question object  
  **Error Codes:** 400 (invalid ID), 401, 403, 404, 500

- `DELETE /:id`  
  **Behavior:** Soft delete (mark as inactive)  
  **Response:** `{ message: "Question deleted successfully" }`  
  **Error Codes:** 400, 401, 403, 404, 500

### Chat (`/api/chat`)
Requires authentication via JWT cookie/header.

- `GET /history/:sessionId`  
  **Query Params:** `limit` (default 50, max 100), `before` (timestamp for pagination)  
  **Response:** Array of messages with fields: `_id, sessionId, userId, text, timestamp`  
  **Error Codes:** 404 (session not found), 403 (wrong user), 500

- `POST /message`  
  **Request Body:** `{ sessionId: string, text: string }`  
  **Response:**  
  ```json
  {
    "messageId": "ObjectId",
    "sessionId": "string",
    "userId": "ObjectId",
    "text": "string",
    "timestamp": "ISO Date"
  }
  ```  
  **Error Codes:** 400 (missing fields), 401, 403, 404, 500

## WebSocket

The server uses the `ws` library for WebSocket functionality, integrated with the HTTP server. Key features include:

### Initialization
- Created with `WebSocketServer` from the `ws` package
- Shares the same port as the HTTP server (default: 5000)
- Logs initialization with timestamp

### Event Handling
1. **Connection**
   - Logs new client connections with timestamp
   - Tracks total connected clients
   - Example log: `[2025-05-02T04:58:08.123Z] New client connected. Total clients: 3`

2. **Message**
   - Parses incoming JSON messages
   - Logs raw and parsed messages with timestamps
   - Broadcasts formatted responses to all connected clients
   - Response format:
     ```json
     {
       "type": "response",
       "timestamp": "ISO 8601 string",
       "data": "message text",
       "clientCount": "number of connected clients"
     }
     ```

3. **Close**
   - Logs disconnection events with reason code and message
   - Updates client count

4. **Error**
   - Logs detailed error messages and stack traces

### Message Flow
1. Client sends JSON message with `text` field
2. Server processes and validates message
3. Server broadcasts response to all connected clients
4. Responses include connection status updates

### Logging Format
All logs follow this pattern:
```
[ISO_TIMESTAMP] [EVENT_TYPE] MESSAGE [METADATA]
```
Example: `[2025-05-02T04:58:08.123Z] Socket error: Error: Connection reset`

### Error Handling
- Graceful error recovery with detailed stack traces
- Connection state validation before message sending
- Size limits enforced by underlying `ws` library

## Configuration
### Environment Variables
| Variable | Description | Default |
|---------|-------------|---------|
| `PORT` | Server port | 5000 |
| `MONGO_URI` | MongoDB connection string | - |
| `JWT_SECRET` | Secret for JWT signing | - |
| `NODE_ENV` | Environment (dev/prod) | development |

## Database Models
### User
- `username`: String (unique)
- `email`: String (unique)
- `password`: String (hashed)
- `createdAt`: Date

### Session
- `name`: String
- `participants`: [User IDs]
- `createdAt`: Date

### Question
- `text`: String
- `author`: User ID
- `tags`: [String]
- `createdAt`: Date

## Middleware
### authMiddleware
Protects routes by verifying JWT tokens from cookies. Adds `req.user` with authenticated user data.

### corsMiddleware
Configured to allow:
- Origins: `http://localhost:3000`, `https://aicopilot-peach.vercel.app`, and devtunnel URLs
- Credentials: Enabled
- Headers: `Content-Type`, `Authorization`, `x-auth-token`

## Testing
Use `test-client.js` to test WebSocket functionality:
```bash
node test-client.js
```

## Deployment
### Docker
Build and run with Docker Compose:
```bash
docker-compose up -d
```

### Production
```bash
npm run build
npm start
```

## File Structure
```
server/
├── config/       # Database configuration
├── controllers/  # Route handlers
├── middleware/   # Custom middleware
├── models/       # Database models
├── routes/       # API routes
├── socket.js     # WebSocket setup
└── app.js        # Main application
```

## Development Tools
- **Linting**: ESLint
- **Testing**: Jest (not shown in files)
- **Logging**: Console with timestamped output
