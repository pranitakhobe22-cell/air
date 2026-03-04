const express = require('express');
const { getForecast } = require('../controllers/forecastController');

const router = express.Router();

// GET /api/v1/forecast
router.get('/', getForecast);

module.exports = router;
