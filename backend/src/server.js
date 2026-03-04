require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Route Imports
const healthRoutes = require('./routes/health');
const apiRoutes = require('./routes/api');

// Service & Utility Imports
const { seedData } = require('./utils/seed');
const simulationService = require('./services/simulationService');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────────
app.use('/api', healthRoutes);
app.use('/api', apiRoutes);

// ── Global Error Handler ────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(`[Error] ${err.stack}`);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
});

// ── Server Start ────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`\n🚀 AERIS Backend Core`);
    console.log(`────────────────────────────────────────────────────────────────`);
    console.log(`📡 Status: Running`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`────────────────────────────────────────────────────────────────\n`);

    // Initialize Demo Data & Services
    await seedData();
    simulationService.start();
});
