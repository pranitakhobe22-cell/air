/**
 * AERIS Backend — Unified Server
 * ────────────────────────────────────────────────────────────────
 * Single entry point for Railway deployment.
 * Combines WebSocket + ESP32 ingest + REST API into one process.
 *
 * Routes:
 *   GET  /health                  — health check
 *   POST /api/v1/ingest           — ESP32 sensor ingestion (X-API-KEY)
 *   GET  /api/v1/latest           — latest reading for dashboard
 *   GET  /api/v1/history          — historical readings
 *   GET  /api/v1/forecast         — AQI forecast
 *   GET  /api/v1/sectors          — sector map data
 *   GET  /api/v1/nodes            — sensor node status
 *   GET  /api/v1/ml/export        — flat JSON for ML model ingestion
 *   POST /api/v1/auth/register    — user registration
 *   POST /api/v1/auth/login       — user login
 *   GET  /api/v1/auth/me          — current user
 *   GET/PUT /api/v1/profile       — user health profile
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');

const { initWebSocket } = require('./websocket/socketService');
const { initCosmos, isConfigured, getContainer } = require('./config/cosmosdb');
const { init: initDb } = require('./src/config/db');
const { seedData } = require('./src/utils/seed');
const simulationService = require('./src/services/simulationService');

const ingestRoutes = require('./routes/ingestRoutes');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const healthRoutes = require('./src/routes/health');
const apiRoutes = require('./src/routes/api');
const weatherRoutes = require('./src/routes/weather');

const app = express();
app.set('trust proxy', true); // Railway reverse proxy — needed for real client IP
const server = http.createServer(app);
const PORT = process.env.MAIN_PORT || process.env.PORT || 3000;

// ── WebSocket ────────────────────────────────────────────────────
initWebSocket(server);

// ── Middleware ───────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request Logger (ingest only) ─────────────────────────────────
app.use((req, res, next) => {
  if (req.path.includes('/ingest')) {
    console.log(`[INGEST] ${req.method} from ${req.ip} — ${new Date().toISOString()}`);
  }
  next();
});

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/v1', healthRoutes);
app.use('/api/v1', apiRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/ingest', ingestRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);

// ── ML Export Endpoint ───────────────────────────────────────────
// GET /api/v1/ml/export?limit=500&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z
// Returns flat JSON array of all sensor readings from Cosmos DB.
// Perfect for pandas: df = pd.read_json('https://.../api/v1/ml/export')
app.get('/api/v1/ml/export', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: 'Cosmos DB not configured' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 500, 5000);
    const from = req.query.from || null;
    const to = req.query.to || null;

    const container = await getContainer('livelogs');

    let queryText = 'SELECT TOP @limit c.timestamp, c.sensorId, c.pm25, c.co, c.o3, c.no2, c.vocIndex, c.temperature, c.humidity, c.oxygen, c.pressure, c.rain, c.pm25RainDelta, c.aqi, c.aqiCategory, c.rri, c.riskLevel FROM c';
    const parameters = [{ name: '@limit', value: limit }];

    const conditions = [];
    if (from) {
      conditions.push('c.timestamp >= @from');
      parameters.push({ name: '@from', value: from });
    }
    if (to) {
      conditions.push('c.timestamp <= @to');
      parameters.push({ name: '@to', value: to });
    }
    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }
    queryText += ' ORDER BY c.timestamp DESC';

    const { resources } = await container.items
      .query({ query: queryText, parameters }, { enableCrossPartitionQuery: true })
      .fetchAll();

    // Flatten for ML: rename vocIndex → voc_index, aqiCategory → aqi_category etc.
    const flat = resources.map(r => ({
      timestamp: r.timestamp,
      sensor_id: r.sensorId,
      pm25: r.pm25,
      co: r.co,
      o3: r.o3,
      no2: r.no2 || 0,
      voc_index: r.vocIndex,
      temperature: r.temperature,
      humidity: r.humidity,
      oxygen: r.oxygen ?? null,
      pressure: r.pressure ?? null,
      rain: r.rain || false,
      pm25_rain_delta: r.pm25RainDelta || 0,
      aqi: r.aqi,
      aqi_category: r.aqiCategory,
      rri: r.rri,
      risk_level: r.riskLevel,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(flat);
  } catch (err) {
    console.error('[ML EXPORT]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Root health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'aeris-unified',
    cosmos: isConfigured() ? 'connected' : 'not configured',
    uptime: process.uptime(),
  });
});

// ── Global Error Handler (Express 5) ────────────────────────────
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body' });
  }
  console.error('[SERVER ERROR]', err.message);
  res.status(500).json({ success: false, error: err.message });
});

// ── Startup ──────────────────────────────────────────────────────
const start = async () => {
  try {
    // Init SQLite (for locations / nodes / alerts - lightweight fallback data)
    await initDb();

    // Init Cosmos DB (primary data store) — with timeout so server still starts
    if (isConfigured()) {
      try {
        await Promise.race([
          initCosmos(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cosmos DB connection timed out after 10s')), 10000))
        ]);
        console.log('✅ [Cosmos] All containers ready');
      } catch (cosmosErr) {
        console.warn('⚠️  [Cosmos] Init failed:', cosmosErr.message, '— continuing without Cosmos');
      }
    } else {
      console.warn('⚠️  [Cosmos] Not configured — set COSMOS_CONNECTION_STRING');
    }

    // Seed demo location / node data into SQLite (only needed when no real hardware)
    if (!isConfigured()) {
      await seedData();
      // Start background simulation only when no real hardware (Cosmos DB not configured)
      simulationService.start();
      console.log('🛰️  [Simulation] Running in demo mode — no real hardware detected');
    } else {
      console.log('🔌 [Hardware] Real ESP32 data via Cosmos DB — simulation disabled');
    }

  } catch (err) {
    console.error('❌ [Startup] Error:', err.message);
    // Don't exit — partial functionality is better than nothing
  }

  server.listen(PORT, () => {
    console.log('\n🌬️  AERIS Unified Backend');
    console.log('────────────────────────────────────────────────────────────────');
    console.log(`📡 Port:     ${PORT}`);
    console.log(`🌐 Public:   ${process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY_STATIC_URL || 'http://localhost:' + PORT}`);
    console.log(`🗄️  Cosmos:   ${isConfigured() ? 'CONFIGURED ✅' : 'NOT SET ❌'}`);
    console.log(`🏥 Health:   /health`);
    console.log(`🤖 ML:       /api/v1/ml/export`);
    console.log('────────────────────────────────────────────────────────────────\n');
  });
};

start();
