const express = require('express');
const { getProfile, updateProfile } = require('../controllers/profileController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/v1/profile (Protected Route)
router.get('/', verifyToken, getProfile);

// PUT /api/v1/profile (Protected Route)
router.put('/', verifyToken, updateProfile);

module.exports = router;
