const express = require('express');
const { getProfile } = require('../controllers/profileController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/v1/profile (Protected Route)
router.get('/', verifyToken, getProfile);

module.exports = router;
