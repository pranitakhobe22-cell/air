'use strict';

const { Router } = require('express');
const { getCurrent, getForecast } = require('../controllers/weatherController');

const router = Router();

// GET /api/v1/weather/current?city=Mumbai  OR  ?lat=19.07&lon=72.87
router.get('/current', getCurrent);

// GET /api/v1/weather/forecast?city=Mumbai  OR  ?lat=19.07&lon=72.87
router.get('/forecast', getForecast);

module.exports = router;
