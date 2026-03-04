const express = require('express');
const { getAlerts } = require('../controllers/alertsController');

const router = express.Router();

// GET /api/v1/alerts
router.get('/', getAlerts);

module.exports = router;
