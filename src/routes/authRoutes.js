const express = require('express');
const router = express.Router();
const { registerPatient, login, getCurrentUser, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public authentication routes
router.post('/register', authLimiter, registerPatient);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

// Authenticated user session
router.get('/me', protect, getCurrentUser);

module.exports = router;
