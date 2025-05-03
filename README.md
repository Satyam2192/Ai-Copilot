# Co-Pilot Application

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



For iOS:

Open the file my-app/ios/my-app/Info.plist.
Add the following key-value pair inside the main <dict> tag:
<key>NSMicrophoneUsageDescription</key>
<string>This app uses the microphone to allow voice input for the chat.</string>
For Android:

Open the file my-app/android/app/src/main/AndroidManifest.xml.
Add the following line just before the <application> tag:
<uses-permission android:
