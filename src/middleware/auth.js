const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    // Support both JWT and API key authentication
    if (authHeader.startsWith('Bearer ')) {
      // JWT token authentication
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
      } catch (jwtError) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    } else if (authHeader.startsWith('ApiKey ')) {
      // API key authentication
      const apiKey = authHeader.substring(7);
      
      // Simple API key validation - in production, store these securely
      const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');
      
      if (!validApiKeys.includes(apiKey)) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      
      req.user = { apiKey: true };
      next();
    } else {
      return res.status(401).json({ error: 'Invalid authorization format. Use "Bearer <token>" or "ApiKey <key>"' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = authMiddleware;