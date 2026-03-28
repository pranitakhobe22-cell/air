import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createHttpServer(port = 3000) {
    const app = express();
    const server = createServer(app);

    // Phase 3 Bugfix: Enable CORS for public dashboards
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        next();
    });

    // Phase 3 Bugfix: API endpoint to fetch test run result JSON for remote CI judges
    app.get('/api/report', (req, res) => {
        const reportPath = path.join(process.cwd(), 'heal-report.json');
        if (fs.existsSync(reportPath)) {
            res.sendFile(reportPath);
        } else {
            res.status(404).json({ error: 'Report not generated yet' });
        }
    });

    // Serve the Dev 2 dashboard
    const dashboardDir = path.join(__dirname, '..', '..', 'dashboard');
    app.use(express.static(dashboardDir));
    
    // Serve fixtures for testing
    const fixturesDir = path.join(__dirname, '..', '..', 'fixtures');
    app.use('/fixtures', express.static(fixturesDir));

    // Serve test pages (e.g. checkout-page.html) at /pages
    const testsDir = path.join(__dirname, '..', '..', 'tests');
    app.use('/pages', express.static(testsDir));

    return { app, server, port };
}
