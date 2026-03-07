require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

const { init: initDb } = require('./config/db');
const { initCosmos } = require('../config/cosmosdb');
const healthRoutes = require('./routes/health');
const apiRoutes = require('./routes/api');
const authRoutes = require('../routes/authRoutes');
const profileRoutes = require('../routes/profileRoutes');
const { seedData } = require('./utils/seed');
const simulationService = require('./services/simulationService');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes — match frontend baseURL: /api/v1 ────────────────────
app.use('/api/v1', healthRoutes);
app.use('/api/v1', apiRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);

// ── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(`[Error] ${err.stack}`);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500,
        },
    });
});

// ── Startup ──────────────────────────────────────────────────────
const start = async () => {
    try {
        await initDb();
        await initCosmos();   // ← ensures users & profiles containers exist

        app.listen(PORT, async () => {
            console.log(`\n🚀 AERIS Backend Core`);
            console.log(`────────────────────────────────────────────────────────────────`);
            console.log(`📡 Status: Running`);
            console.log(`🌐 Port:   ${PORT}`);
            console.log(`🏥 Health: http://localhost:${PORT}/api/v1/health`);
            console.log(`────────────────────────────────────────────────────────────────\n`);

            await seedData();
            simulationService.start();
        });
    } catch (err) {
        console.error('❌ [Server] Failed to start:', err.message);
        process.exit(1);
    }
};

start();
