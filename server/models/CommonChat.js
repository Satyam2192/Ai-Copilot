import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'] },
  content: String,
  sender: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String
  },
  timestamp: { type: Date, default: Date.now }
});

const CommonChatSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Global Chat'
  },
  description: {
    type: String,
    default: 'A chat room for all users'
  },
  isGlobal: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: { 
    type: Date,
    default: Date.now
  },
  messages: [MessageSchema],
  activeUsers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    lastActive: { type: Date, default: Date.now }
  }]
});

export default mongoose.model('CommonChat', CommonChatSchema);
