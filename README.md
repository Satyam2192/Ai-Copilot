# Interview Co-Pilot Application

## Setup
1. Copy `.env.example` to `.env` in `server/` and fill in secrets.
2. `docker-compose up --build`

## Client
- Runs on port 3000
- React + Tailwind CSS
- Uses Web Speech API and Socket.IO

## Server
- Runs on port 5000
- Express + Socket.IO + MongoDB
- Integrates Google Gemini GenAI API
