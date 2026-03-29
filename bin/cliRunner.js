import { chromium } from '@playwright/test';
import { setRunnerContext, getStepHistory } from '../src/runner/playwrightRunner.js';
import { writeReport } from '../src/storage/healReport.js';
import { createHttpServer } from '../src/server/httpServer.js';
import { createWsServer } from '../src/server/wsServer.js';
import { closeDb } from '../src/storage/healHistory.js';
import { scoreFragility } from '../src/intent/fragilityScorer.js';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import readline from 'readline';
import net from 'net';

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, answer => { rl.close(); resolve(answer.trim()); }));
}

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

async function runTests(absFile, targetUrl, serverUrl, io) {
    const browser = await chromium.launch({ headless: false });
    activeBrowser = browser;
    const context = await browser.newContext();
    const page = await context.newPage();

    io.emit('run:start', { testFile: absFile, targetUrl });
    console.log(`\n  [RUN] Target: ${targetUrl}`);

    let status = 'passed';
    try {
        const testScript = await import(pathToFileURL(absFile).href);
        const testFn = testScript.default || testScript.run;
        await testFn(page, { serverUrl, targetUrl });
        console.log(`\n  [OK] All steps complete.`);
    } catch (err) {
        if (err.message?.includes('closed') || err.message?.includes('Target page')) {
            status = 'stopped';
            console.log(`\n  [STOP] Run stopped by user.`);
        } else {
            status = 'failed';
            console.error(`\n  [ERR] Test failure:`, err.message);
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
        console.error('[ERR] File not found:', absFile);
        process.exit(1);
    }

    console.log('\n=======================================');
    console.log('         SelfHeal Test Runner         ');
    console.log('=======================================\n');

    const scores = scoreFragility(absFile);

    const targetUrl = await askQuestion('  Enter the website URL to test: ');
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        console.error('  [ERR] Invalid URL. Must start with http:// or https://');
        process.exit(1);
    }
    console.log(`  Target: ${targetUrl}\n`);

    const port = await findFreePort(3000);
    const { app, server } = createHttpServer(port);
    const io = createWsServer(server);
    const serverUrl = `http://localhost:${port}`;

    io.on('connection', (socket) => {
        socket.emit('fragility:data', scores);
        socket.emit('run:ready', { testFile: absFile, targetUrl });

        socket.on('run:trigger', async () => {
            if (activeBrowser) {
                socket.emit('run:error', { message: 'Already running' });
                return;
            }
            setRunnerContext({ testFile: absFile, io });
            await runTests(absFile, targetUrl, serverUrl, io);
        });

        socket.on('run:stop', () => {
            if (activeBrowser) {
                console.log('\n  [STOP] Stop requested — closing browser...');
                activeBrowser.close().catch(() => {});
            }
        });
    });

    await new Promise(resolve => server.listen(port, resolve));
    console.log(`  Dashboard: ${serverUrl}`);

    if (dashboard) {
        open(serverUrl);
        console.log('  Dashboard open — click Run to start.\n');
        process.stdin.resume();
    } else {
        setRunnerContext({ testFile: absFile, io });
        const status = await runTests(absFile, targetUrl, serverUrl, io);
        closeDb();
        process.exit(status === 'passed' ? 0 : 1);
    }
}
