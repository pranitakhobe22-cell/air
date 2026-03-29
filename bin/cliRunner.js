import { chromium } from '@playwright/test';
import { setRunnerContext, getStepHistory } from '../src/runner/playwrightRunner.js';
import { writeReport } from '../src/storage/healReport.js';
import { createHttpServer } from '../src/server/httpServer.js';
import { createWsServer } from '../src/server/wsServer.js';
import { initDb, closeDb } from '../src/storage/healHistory.js';
import { scoreFragility } from '../src/intent/fragilityScorer.js';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import net from 'net';

function findFreePort(startPort = 3000) {
    return new Promise((resolve) => {
        const tryPort = (port) => {
            const s = net.createServer();
            s.once('error', () => tryPort(port + 1));
            s.once('listening', () => s.close(() => resolve(port)));
            s.listen(port);
        };
        tryPort(startPort);
    });
}

let activeBrowser = null;

async function runTests(absFile, serverUrl, io) {
    const browser = await chromium.launch({ headless: false });
    activeBrowser = browser;
    const context = await browser.newContext();
    const page = await context.newPage();

    io.emit('run:start', { testFile: absFile, targetUrl: serverUrl });

    let status = 'passed';
    try {
        const testScript = await import(pathToFileURL(absFile).href);
        const testFn = testScript.default || testScript.run;
        await testFn(page, { serverUrl, targetUrl: serverUrl });
        console.log(`\n  ✓ All steps complete.`);
    } catch (err) {
        if (err.message?.includes('closed') || err.message?.includes('Target page')) {
            status = 'stopped';
            console.log(`\n  ■ Run stopped.`);
        } else {
            status = 'failed';
            console.error(`\n  ✗ Test failure:`, err.message);
        }
    } finally {
        activeBrowser = null;
        try { await browser.close(); } catch {}
    }

    writeReport(absFile, getStepHistory());
    io.emit('run:complete', { status });
    return status;
}

export async function executeCLI(testFile, dashboard) {
    const absFile = path.resolve(testFile);
    if (!fs.existsSync(absFile)) {
        console.error('  [ERR] File not found:', absFile);
        process.exit(1);
    }

    await initDb();

    const scores = scoreFragility(absFile);

    // Start local server (serves test HTML pages + dashboard)
    const port = await findFreePort(3000);
    const { app, server } = createHttpServer(port);
    const io = createWsServer(server);
    const serverUrl = `http://localhost:${port}`;

    await new Promise(resolve => server.listen(port, resolve));

    // Dashboard socket handlers (for when someone opens the dashboard URL)
    io.on('connection', (socket) => {
        socket.emit('fragility:data', scores);
        socket.emit('run:ready', { testFile: absFile, targetUrl: serverUrl });

        socket.on('run:trigger', async () => {
            if (activeBrowser) {
                socket.emit('run:error', { message: 'Already running' });
                return;
            }
            setRunnerContext({ testFile: absFile, io });
            await runTests(absFile, serverUrl, io);
        });

        socket.on('run:stop', () => {
            if (activeBrowser) {
                activeBrowser.close().catch(() => {});
            }
        });
    });

    if (dashboard) {
        // --dashboard flag: open browser to dashboard, wait for user to click Run
        console.log(`\n  Dashboard: ${serverUrl}`);
        open(serverUrl);
        console.log('  Dashboard opened — click Run to start.\n');
        process.stdin.resume();
    } else {
        // Default: auto-run silently, solve errors, show progress in terminal
        console.log(`\n  SelfHeal — Running: ${path.basename(absFile)}`);
        console.log(`  Selectors: ${scores.length} found | Server: ${serverUrl}`);
        console.log(`  (Open ${serverUrl} for live dashboard)\n`);

        setRunnerContext({ testFile: absFile, io });
        const status = await runTests(absFile, serverUrl, io);

        // Summary
        const steps = getStepHistory();
        const passed = steps.filter(s => s.status === 'pass').length;
        const healed = steps.filter(s => s.status === 'healed').length;
        const failed = steps.filter(s => s.status === 'fail').length;

        console.log(`\n  ─── Results ───────────────────────────`);
        console.log(`  Passed: ${passed}  Healed: ${healed}  Failed: ${failed}`);
        if (healed > 0) console.log(`  ${healed} selector(s) auto-healed by AI`);
        console.log(`  Report: heal-report.json`);
        console.log(`  Dashboard: ${serverUrl} (still running)`);
        console.log(`  ────────────────────────────────────────\n`);

        closeDb();

        if (failed > 0) {
            process.exit(1);
        } else {
            // Keep server alive briefly so user can check dashboard if needed
            setTimeout(() => { server.close(); process.exit(0); }, 3000);
        }
    }
}
