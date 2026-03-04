/**
 * AERIS Backend — Entry Point
 * ────────────────────────────────────────────────────────────────
 * Express server providing the live API for the structural frontend.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for Socket.IO
const { initWebSocket } = require('./websocket/socketService');
const { initNetworkMonitor } = require('./services/networkService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Services
initWebSocket(server);
initNetworkMonitor();

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health Check ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'aeris-core-api',
    uptime: process.uptime()
  });
});

// ── API Routes (Active) ──────────────────────────────────────────
const apiRouter = express.Router();

const authRoutes = require('./routes/authRoutes');
const ingestRoutes = require('./routes/ingestRoutes');
const environmentRoutes = require('./routes/environmentRoutes');
const alertsRoutes = require('./routes/alertsRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const networkRoutes = require('./routes/networkRoutes');
const profileRoutes = require('./routes/profileRoutes');

apiRouter.use('/auth', authRoutes);
apiRouter.use('/ingest', ingestRoutes);
apiRouter.use('/environment', environmentRoutes);
apiRouter.use('/alerts', alertsRoutes);
apiRouter.use('/forecast', forecastRoutes);
apiRouter.use('/network', networkRoutes);
apiRouter.use('/profile', profileRoutes);

app.use('/api/v1', apiRouter);

// ── Server Start ────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🌬️  AERIS Core API & WebSocket Server`);
  console.log(`────────────────────────────────────────────────────────────────`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});
