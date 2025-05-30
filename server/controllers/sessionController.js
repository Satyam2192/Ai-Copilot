import Session from '../models/Session.js';

const USER_GLOBAL_SETTINGS_TOPIC = "user_global_settings";

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
    let session;
    const { id } = req.params;

    if (id === 'global') {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated for global session settings' });
      }
      session = await Session.findOne({ userId: req.user.id, topic: USER_GLOBAL_SETTINGS_TOPIC })
        .select('-feedback')
        .lean();
      // If session is null (not found), the logic below will handle it by returning 404
      // or the client can interpret a null/empty response as "no global settings saved yet".
    } else {
      session = await Session.findById(id)
        .select('-feedback')
        .lean();
    }

    if (!session) {
      // If 'global' settings were requested and not found, we might not want a 404,
      // but rather an empty/default object, or let client handle absence.
      // For now, consistent 404 if no session doc is found.
      // Client can create one via PATCH to /api/sessions/global if it gets a 404.
      return res.status(404).json({ error: `Session ${id === 'global' ? 'global settings' : id} not found` });
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

    const isGlobalSessionRequest = (id === "global");

    const updateData = {};
    // Only allow topic update if it's not the special "global" session request
    // and if topic is actually provided in the request body.
    if (!isGlobalSessionRequest && topic !== undefined) {
        updateData.topic = topic;
    }
    // System prompt can always be updated if provided.
    if (systemPrompt !== undefined) {
        updateData.systemPrompt = systemPrompt;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    let query;
    if (isGlobalSessionRequest) {
      query = { userId: userId, topic: USER_GLOBAL_SETTINGS_TOPIC };
    } else {
      // For non-global requests, 'id' is expected to be an ObjectId string.
      // Mongoose will attempt to cast 'id' to ObjectId. If it fails (e.g., "global" or malformed),
      // it will throw a CastError, which will be caught by the main try-catch block.
      query = { _id: id, userId: userId };
    }

    // Perform the update/upsert
    const initialUpdateResult = await Session.findOneAndUpdate(
      query,
      { $set: updateData }, // Only set the fields present in updateData
      { new: true, upsert: isGlobalSessionRequest } // upsert is true for global
    ); // Intentionally remove .lean() for a moment from the main update

    if (!initialUpdateResult) {
      if (isGlobalSessionRequest) {
        console.error(`[updateSession] Failed to upsert global session for user ${userId} with topic ${USER_GLOBAL_SETTINGS_TOPIC}. Query: ${JSON.stringify(query)}, UpdateData: ${JSON.stringify(updateData)}`);
        return res.status(500).json({ error: 'Failed to update or create global session settings (initial upsert failed)' });
      } else {
        const sessionExists = await Session.exists({ _id: id });
        if (!sessionExists) {
          return res.status(404).json({ error: 'Session not found' });
        } else {
          return res.status(403).json({ error: 'User not authorized to update this session' });
        }
      }
    }

    // For global session, re-fetch to be absolutely sure what was saved, then .lean() for response
    let finalSessionData;
    if (isGlobalSessionRequest) {
        const refetchedSession = await Session.findOne(query).lean(); // Re-fetch and then lean
        if (!refetchedSession) {
            console.error(`[updateSession] Global session disappeared after upsert for user ${userId}. Query: ${JSON.stringify(query)}`);
            return res.status(500).json({ error: 'Global session data inconsistency after update.' });
        }
        finalSessionData = refetchedSession;
    } else {
        // For regular sessions, initialUpdateResult is a Mongoose document here.
        finalSessionData = initialUpdateResult.toObject(); // Convert to plain object
    }
    
    res.json({
      message: 'Session updated successfully',
      session: {
        _id: finalSessionData._id,
        topic: finalSessionData.topic,
        systemPrompt: finalSessionData.systemPrompt, // This is the critical value
        lastActive: finalSessionData.lastActive // Ensure this field exists or handle if not
      }
    });

  } catch (error) {
    console.error(`[updateSession] Error updating session ${req.params.id}:`, error);
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
