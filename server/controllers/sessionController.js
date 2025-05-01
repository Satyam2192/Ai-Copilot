import Session from '../models/Session.js';

// Start a new session
export async function startSession(req, res) {
  // Assuming auth middleware populates req.user
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Create session
    const session = await Session.create({
      userId: req.user.id, // Use authenticated user ID
      topic: req.body.topic || 'General Interview',
      systemPrompt: req.body.systemPrompt || '', // Add systemPrompt from request
      startTime: new Date(),
      lastActive: new Date(),
      interactionCount: 0,
      messages: [],
      metadata: { // Initialize metadata object
        userAgent: req.headers['user-agent'],
        platform: req.body.platform || 'web',
        initialTopic: req.body.topic
      }
    });

    // Update metadata with session ID after creation (Mongoose handles Map conversion here)
    session.metadata.set('sessionId', session._id.toString());
    await session.save();

    res.status(201).json({ // Use 201 Created status
      sessionId: session._id,
      startTime: session.startTime,
      topic: session.topic,
      systemPrompt: session.systemPrompt,
      userId: req.user.id
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session', details: error.message });
  }
}

// Get a specific session by ID
export async function getSession(req, res) {
  try {
    const session = await Session.findById(req.params.id)
      .select('-feedback') // Exclude feedback data by default
      .lean(); // Use lean for performance

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Explicitly construct the response object after .lean()
    // Ensure metadata is a non-null object before assigning
    const responseData = {
      _id: session._id,
      userId: session.userId,
      topic: session.topic,
      systemPrompt: session.systemPrompt,
      startTime: session.startTime,
      endTime: session.endTime,
      lastActive: session.lastActive,
      interactionCount: session.interactionCount,
      messages: session.messages,
      metadata: (typeof session.metadata === 'object' && session.metadata !== null) ? session.metadata : {} // Safely handle metadata
    };

    res.json(responseData);

  } catch (error) {
    console.error(`Error getting session ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve session', details: error.message });
  }
}

// List sessions for the authenticated user
export async function listSessions(req, res) {
  try {
    const filter = {
      userId: req.user.id,
      interactionCount: { $gt: 0 } // Filter out sessions with no interactions
    };

    if (req.query.topic) {
      filter.topic = { $regex: req.query.topic, $options: 'i' };
    }

    const sessions = await Session.find(filter)
      .sort('-startTime')
      .limit(parseInt(req.query.limit, 10) || 50) // Allow limit via query param
      .select('topic startTime lastActive interactionCount systemPrompt _id') // Select necessary fields + _id
      .lean(); // Use lean for performance

    // Map results, ensuring metadata is handled safely after .lean()
    const responseData = sessions.map(session => {
      const metadataObject = (typeof session.metadata === 'object' && session.metadata !== null) ? session.metadata : {};
      return {
        _id: session._id, // Ensure _id is included
        topic: session.topic,
        startTime: session.startTime,
        lastActive: session.lastActive,
        interactionCount: session.interactionCount,
        systemPrompt: session.systemPrompt,
        metadata: metadataObject // Assign the verified or default metadata object
      };
    });

    res.json(responseData);

  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions', details: error.message });
  }
}

// Update session feedback
export async function updateSessionFeedback(req, res) {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Ensure user owns the session
    if (session.userId.toString() !== req.user.id) {
        return res.status(403).json({ error: 'User not authorized for this session' });
    }

    // Update feedback using Mongoose Map methods for safety
    const updatePath = req.body.path || 'general'; // Simplified path for now
    const feedbackValue = {
        value: req.body.value,
        timestamp: new Date(),
        userId: req.user.id,
        source: req.body.source || 'user'
    };
    session.feedback.set(updatePath, feedbackValue); // Use .set() on the Map

    await session.save();

    res.json({
      message: 'Feedback updated successfully',
      feedback: Object.fromEntries(session.feedback) // Convert Map to object for response
    });

  } catch (error) {
    console.error(`Error updating feedback for session ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to update feedback',
      details: error.message
     });
  }
}


// Delete a session
export async function deleteSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the session first to check ownership before deleting
    const sessionToDelete = await Session.findOne({ _id: id, userId: userId });

    if (!sessionToDelete) {
      const exists = await Session.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({ error: 'Session not found' });
      } else {
        // Session exists but belongs to another user
        return res.status(403).json({ error: 'User not authorized to delete this session' });
      }
    }

    // Delete the session
    await Session.deleteOne({ _id: id, userId: userId });

    res.status(200).json({ message: 'Session deleted successfully', sessionId: id }); // Use 200 OK or 204 No Content

  } catch (error) {
    console.error(`Error deleting session ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to delete session',
      details: error.message
    });
  }
}

// Update general session details (topic, systemPrompt)
export async function updateSession(req, res) {
  try {
    const { id } = req.params;
    const { topic, systemPrompt } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (topic !== undefined) updateData.topic = topic;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    // Find the session and ensure the user owns it before updating
    const updatedSession = await Session.findOneAndUpdate(
      { _id: id, userId: userId }, // Match session ID and user ID
      { $set: updateData },
      { new: true } // Return the updated document
    ).lean(); // Use lean for efficiency

    if (!updatedSession) {
      // Check if session exists but belongs to another user
      const exists = await Session.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({ error: 'Session not found' });
      } else {
        return res.status(403).json({ error: 'User not authorized to update this session' });
      }
    }

    // Construct response with relevant fields
    res.json({
      message: 'Session updated successfully',
      session: {
        _id: updatedSession._id,
        topic: updatedSession.topic,
        systemPrompt: updatedSession.systemPrompt,
        lastActive: updatedSession.lastActive
      }
    });

  } catch (error) {
    console.error(`Error updating session ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to update session',
      details: error.message
    });
  }
}

// End a session
export async function endSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the session first to check ownership
    const sessionToEnd = await Session.findOne({ _id: id, userId: userId });

    if (!sessionToEnd) {
       const exists = await Session.exists({ _id: id });
       if (!exists) {
           return res.status(404).json({ error: 'Session not found' });
       } else {
           return res.status(403).json({ error: 'User not authorized to end this session' });
       }
    }

    // Update the session
    sessionToEnd.endTime = new Date();
    sessionToEnd.metadata.set('sessionEnded', true);
    sessionToEnd.metadata.set('endMethod', req.body.method || 'manual');
    await sessionToEnd.save();

    res.json({
      message: 'Session ended successfully',
      sessionId: sessionToEnd._id,
      endTime: sessionToEnd.endTime
    });
  } catch (error) {
     console.error(`Error ending session ${req.params.id}:`, error);
     res.status(500).json({
       error: 'Failed to end session',
       details: error.message
     });
  }
}
