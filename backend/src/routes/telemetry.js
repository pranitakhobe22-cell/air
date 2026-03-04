const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');

router.get('/telemetry/latest', telemetryController.getLatestReadings);
router.get('/alerts', telemetryController.getRecentAlerts);

module.exports = router;
