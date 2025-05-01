import Session from '../models/Session.js';
export async function startSession(req, res) {
  // Assuming auth middleware populates req.user
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Create session
  const session = await Session.create({
    userId: req.user.id, // Use authenticated user ID
    topic: req.body.topic || 'General Interview',
    startTime: new Date(),
    lastActive: new Date(),
    interactionCount: 0,
    messages: [],
    metadata: {
      userAgent: req.headers['user-agent'],
      platform: req.body.platform || 'web',
      initialTopic: req.body.topic
    }
  });

  // Update metadata with session ID after creation
  session.metadata.sessionId = session._id;
  await session.save();

  res.json({
    sessionId: session._id,
    startTime: session.startTime,
    topic: session.topic,
    userId: req.user.id // Use authenticated user ID
  });
}

export async function getSession(req, res) {
  const session = await Session.findById(req.params.id)
    .select('-feedback') // Exclude feedback data by default
    .lean();
    
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Convert metadata Map to plain object for JSON serialization
  res.json({
    ...session,
    metadata: Object.fromEntries(session.metadata)
  });
}

export async function listSessions(req, res) {
  const filter = {
    userId: req.user.id
  };
  
  if (req.query.topic) {
    filter.topic = { $regex: req.query.topic, $options: 'i' };
  }
  
  const sessions = await Session.find(filter)
    .sort('-startTime')
    .limit(50)
    .select('topic startTime lastActive interactionCount')
    .lean();
    
  res.json(sessions.map(session => ({
    ...session,
    metadata: Object.fromEntries(session.metadata)
  })));
}

export async function updateSessionFeedback(req, res) {
  try {
    const session = await Session.findById(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Update feedback with nested structure
    const updatePath = req.body.path?.split('.') || ['general'];
    let current = session.feedback;
    
    for (let i = 0; i < updatePath.length - 1; i++) {
      current = current[updatePath[i]] = current[updatePath[i]] || {};
    }
    
    current[updatePath[updatePath.length - 1]] = {
      value: req.body.value,
      timestamp: new Date(),
      userId: req.user.id,
      source: req.body.source || 'user'
    };
    
    await session.save();
    
    res.json({
      message: 'Feedback updated successfully',
      feedback: session.feedback
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to update feedback',
      details: error.message 
    });
  }
}

export async function endSession(req, res) {
  const session = await Session.findByIdAndUpdate(
    req.params.id,
    { 
      endTime: new Date(),
      'metadata.sessionEnded': true,
      'metadata.endMethod': req.body.method || 'manual'
    },
    { new: true }
  );
  
  res.json({
    message: 'Session ended successfully',
    sessionId: session._id,
    endTime: session.endTime
  });
}
