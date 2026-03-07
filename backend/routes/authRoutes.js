const express = require('express');
const { register, login, me } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/v1/auth/register
router.post('/register', register);

// POST /api/v1/auth/login
router.post('/login', login);

// GET /api/v1/auth/me (Protected route example)
router.get('/me', verifyToken, me);

// PUT /api/v1/auth/update
router.put('/update', verifyToken, require('../controllers/authController').updateAccount);

module.exports = router;
