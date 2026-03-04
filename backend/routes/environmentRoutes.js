const express = require('express');
const { getLatest, getHistory } = require('../controllers/environmentController');

const router = express.Router();

// GET /api/v1/environment/latest
router.get('/latest', getLatest);

// GET /api/v1/environment/history
router.get('/history', getHistory);

module.exports = router;
