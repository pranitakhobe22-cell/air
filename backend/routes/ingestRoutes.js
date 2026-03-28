/**
 * AERIS Backend — Sensor Ingestion Route
 * ────────────────────────────────────────────────────────────────
 * POST /api/v1/ingest
 *
 * Protected by X-API-KEY header (not JWT).
 * Receives environmental telemetry from ESP32 edge nodes.
 */

const express = require('express');
const { verifyApiKey } = require('../middleware/apiKeyMiddleware');
const { ingestData } = require('../controllers/ingestController');

const router = express.Router();

// POST /api/v1/ingest — ESP32 sensor data ingestion
router.post('/', verifyApiKey, ingestData);

module.exports = router;

