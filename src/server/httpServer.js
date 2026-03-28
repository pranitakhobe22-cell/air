import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createHttpServer(port = 3000) {
    const app = express();
    const server = createServer(app);

    // Serve the Dev 2 dashboard
    const dashboardDir = path.join(__dirname, '..', '..', 'dashboard');
    app.use(express.static(dashboardDir));
    
    // Serve fixtures for testing
    const fixturesDir = path.join(__dirname, '..', '..', 'fixtures');
    app.use('/fixtures', express.static(fixturesDir));

    return { app, server, port };
}
