const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Admin = require('../models/Admin');

/**
 * Generate a JWT token with user id, role, and email
 */
const generateToken = (payload) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_vit_2026';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Protect routes: verify JWT from Authorization header or HTTP-only cookie
 */
const protect = async (req, res, next) => {
  let token;

  // Check Bearer Token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Or check cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Please log in to proceed.'
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_vit_2026';
    const decoded = jwt.verify(token, secret);

    // Verify user still exists in database according to role
    let currentUser;
    if (decoded.role === 'patient') {
      currentUser = await Patient.findById(decoded.id).select('-passwordHash');
    } else if (decoded.role === 'doctor') {
      currentUser = await Doctor.findById(decoded.id).select('-passwordHash');
    } else if (decoded.role === 'admin') {
      currentUser = await Admin.findById(decoded.id).select('-passwordHash');
    }

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this session no longer exists.'
      });
    }

    // Attach user to request object
    req.user = {
      id: currentUser._id.toString(),
      _id: currentUser._id,
      role: decoded.role,
      name: currentUser.name,
      email: currentUser.email,
      doc: currentUser
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid session token. Please log in again.'
    });
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${roles.join(', ')}] role.`
      });
    }
    next();
  };
};

/**
 * Optional authentication middleware:
 * Populates req.user if a valid JWT token is provided, but does not block unauthenticated access.
 */
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_vit_2026';
    const decoded = jwt.verify(token, secret);

    let currentUser;
    if (decoded.role === 'patient') {
      currentUser = await Patient.findById(decoded.id).select('-passwordHash');
    } else if (decoded.role === 'doctor') {
      currentUser = await Doctor.findById(decoded.id).select('-passwordHash');
    } else if (decoded.role === 'admin') {
      currentUser = await Admin.findById(decoded.id).select('-passwordHash');
    }

    if (currentUser) {
      req.user = {
        id: currentUser._id.toString(),
        _id: currentUser._id,
        role: decoded.role,
        name: currentUser.name,
        email: currentUser.email,
        doc: currentUser
      };
    }
  } catch (error) {
    // Proceed as unauthenticated guest if token is invalid or expired
  }

  next();
};

module.exports = {
  generateToken,
  protect,
  authorize,
  optionalAuth
};
