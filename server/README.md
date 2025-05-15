# Interview Copilot Server

This is the backend server for Interview Copilot, deployed on Vercel.

## Deployment

### Vercel Deployment

To deploy this server on Vercel, follow these steps:

1. Install the Vercel CLI (if not already installed):
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy to Vercel from the server directory:
```bash
cd server
vercel
```

4. During deployment, Vercel will ask you some questions:
   - Set up and deploy: Yes
   - Which scope: Choose your account/organization
   - Link to existing project: No (if this is the first deployment)
   - Project name: interview-copilot-server
   - Directory: . (current directory)
   - Override settings: No

5. Set up the environment variables in Vercel:
   - Log in to the Vercel dashboard
   - Select your project
   - Go to "Settings" > "Environment Variables"
   - Add the following variables:
     - `MONGO_URI`: Your MongoDB connection string
     - `JWT_SECRET`: Your JWT secret key
     - `API_Key`: Your API key
     - `VERCEL`: Set to "1"
     - `NODE_ENV`: Set to "production"
     - `CLIENT_URL`: Your client app URL

### Project Structure

- `app.js`: Main application file
- `vercel.json`: Vercel deployment configuration
- `config/`: Configuration files
- `controllers/`: Route controllers
- `models/`: MongoDB models
- `routes/`: API routes
- `middleware/`: Express middleware

### Important Notes

- WebSocket functionality is disabled in Vercel serverless environment
- The server is configured to work in both local and Vercel environments
- Production database connection is secured using environment variables
