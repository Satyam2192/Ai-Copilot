import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const formatLog = (level, module, message, metadata = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    module,
    message,
    ...metadata
  };
  
  // Format for console readability
  const formatted = `[${timestamp}] [${level}] [AUTH] ${message}`;
  if (level === 'ERROR') {
    console.error(formatted, metadata);
  } else if (level === 'WARN') {
    console.warn(formatted, metadata);
  } else {
    console.log(formatted, metadata);
  }
  
  return logEntry;
};

export async function register(req, res) {
  try {
    formatLog('INFO', 'register', 'Registration attempt', {
      email: req.body.email,
      ip: req.ip
    });
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      formatLog('WARN', 'register', 'Missing email or password', {
        emailProvided: !!email,
        passwordProvided: !!password
      });
      return res.status(400).send('Email and password are required');
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      formatLog('WARN', 'register', 'Email already exists', { email });
      return res.status(400).send('Email already exists');
    }
    
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash: hash });
    
    formatLog('INFO', 'register', 'User created successfully', {
      userId: user._id,
      email: user.email // Removed duplicate lines
    });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET);
    // Set token in both httpOnly cookie and x-auth-token header
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    res.header('x-auth-token', token); // Send token in header for client interceptor
    res.json({
      user: {
        _id: user._id, // Add _id
        email: user.email,
        createdAt: user.createdAt
      } 
    });
  } catch (error) {
    formatLog('ERROR', 'register', 'Registration failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).send('Registration failed');
  }
}

export async function login(req, res) {
  try {
    formatLog('INFO', 'login', 'Login attempt', {
      email: req.body.email,
      ip: req.ip
    });
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      formatLog('WARN', 'login', 'Missing email or password', {
        emailProvided: !!email,
        passwordProvided: !!password
      });
      return res.status(400).send('Email and password are required');
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      formatLog('WARN', 'login', 'User not found', { email });
      return res.status(401).send('Invalid credentials');
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      formatLog('WARN', 'login', 'Invalid password', { email });
      return res.status(401).send('Invalid credentials');
    }
    
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET);
    
    formatLog('INFO', 'login', 'Login successful', {
      userId: user._id,
      userId: user._id,
      email: user.email
    });

    // Set token in both httpOnly cookie and x-auth-token header
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    res.header('x-auth-token', token); // Send token in header for client interceptor
    res.json({
      user: {
        _id: user._id, // Add _id
        email: user.email,
        lastLogin: new Date()
      } 
    });
  } catch (error) {
    formatLog('ERROR', 'login', 'Login failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).send('Login failed');
  }
}

export function me(req, res) {
  try {
    formatLog('INFO', 'me', 'Fetching user profile', {
      userId: req.user.id,
      ip: req.ip
    });
    
    if (!req.user) {
      formatLog('WARN', 'me', 'No user in request', { ip: req.ip });
      return res.status(401).send('Unauthorized');
    }
    
    res.json({ 
      user: { 
        _id: req.user.id, // Change id to _id for consistency
        email: req.user.email,
        lastAccess: new Date()
      } 
    });
  } catch (error) {
    formatLog('ERROR', 'me', 'Failed to fetch user profile', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).send('Failed to fetch user profile');
  }
}
