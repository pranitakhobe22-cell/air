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

export async function executeCLI(testFile, dashboard) {
    const absFile = path.resolve(testFile);
    if (!fs.existsSync(absFile)) {
        console.error('File not found:', absFile);
        process.exit(1);
    }

    // PHASE 4: INTENT LAYER - FRAGILITY SCORE
    console.log('\n=======================================');
    console.log('       🩺 SelfHeal Test Runner       ');
    console.log('=======================================\n');

    scoreFragility(absFile);

    // SERVER / DASHBOARD
    const { app, server, port } = createHttpServer(3000);
    const io = createWsServer(server);
    
    await new Promise(resolve => server.listen(port, resolve));
    const url = `http://localhost:${port}`;
    console.log(`  🌐 Dashboard: ${url}`);
    if (dashboard) open(url);

    // PLAYWRIGHT RUNNER INIT
    setRunnerContext({ testFile: absFile, io });

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    let status = 'passed';
    console.log(`\n  🚀 Executing tests...`);

    try {
        const testScript = await import(absFile);
        const testFn = testScript.default || testScript.run;
        await testFn(page, { serverUrl: url });
        console.log(`\n  ✅ All steps complete!`);
    } catch(err) {
        status = 'failed';
        console.error(`\n  ❌ Test failure:`, err.message);
    }

    // TEARDOWN
    writeReport(absFile, getStepHistory());
    
    if (dashboard) {
        console.log(`  Press Ctrl+C to exit.`);
        io.emit('run:complete', { status, duration: '0s' });
    } else {
        await browser.close();
        closeDb();
        process.exit(status === 'passed' ? 0 : 1);
    }
}
