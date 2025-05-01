import mongoose from 'mongoose';

const DialogueSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'] },
  content: String,
  timestamp: { type: Date, default: Date.now }
});

const SessionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  topic: { 
    type: String,
    default: 'General Interview'
  },
  systemPrompt: {
    type: String,
    default: '' // Or null, depending on preference
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  lastActive: { 
    type: Date,
    default: Date.now
  },
  interactionCount: { 
    type: Number,
    default: 0
  },
  messages: [DialogueSchema],
  feedback: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

export default mongoose.model('Session', SessionSchema);
