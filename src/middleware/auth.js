const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Allows testing without actual JWTs
  if (process.env.BYPASS_AUTH === 'true') {
    req.user = { id: 'dummy-user', role: 'doctor' };
    return next();
  }

  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

module.exports = authMiddleware;
