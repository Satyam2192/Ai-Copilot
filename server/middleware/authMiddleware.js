// authMiddleware.js
import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  // Extract token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'NO_TOKEN'
    });
  }

  try {
    // Verify token using environment variable
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'interview_secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ 
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      error: error.message
    });
  }
}
