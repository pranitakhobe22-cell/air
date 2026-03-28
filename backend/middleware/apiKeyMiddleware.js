/**
 * AERIS Backend — API Key Middleware (Sensor Ingestion)
 * ────────────────────────────────────────────────────────────────
 * Authenticates ESP32 edge nodes via the X-API-KEY header.
 * This is intentionally separate from JWT auth (user sessions).
 *
 * Usage:
 *   router.post('/ingest', verifyApiKey, ingestController);
 */

const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing X-API-KEY header. Sensor nodes must authenticate.'
    });
  }

  const expectedKey = process.env.INGEST_API_KEY;

  if (!expectedKey) {
    console.error('[AUTH] INGEST_API_KEY is not set in environment variables.');
    return res.status(500).json({
      success: false,
      error: 'Server misconfiguration: ingestion key not set'
    });
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key. Access denied.'
    });
  }

  next();
};

module.exports = { verifyApiKey };

