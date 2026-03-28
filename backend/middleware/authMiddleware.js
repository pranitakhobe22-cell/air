const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'aeris-development-jwt-super-secret-key-please-change-in-prod';

const verifyToken = (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized to access this route, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // attaching decoded payload (e.g., userId) to request
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token is invalid or expired' });
  }
};

module.exports = { verifyToken };

