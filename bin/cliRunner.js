import { chromium } from '@playwright/test';
import { setRunnerContext, resetRunnerContext } from '../src/runner/playwrightRunner.js';
import { createHttpServer } from '../src/server/httpServer.js';
import { createWsServer, broadcast } from '../src/server/wsServer.js';
import db, { closeDb } from '../src/storage/db.js';
import { scoreFragility } from '../src/intent/fragilityScorer.js';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { generateReport } from '../src/reporter/healReporter.js';

export async function executeCLI(testFile, dashboard, panel = false) {
    resetRunnerContext();
    const absFile = path.resolve(testFile);
    if (!fs.existsSync(absFile)) {
        console.error('File not found:', absFile);
        process.exit(1);
    }

    console.log('\n=======================================');
    console.log('       🩺 SelfHeal Test Runner       ');
    console.log('=======================================\n');

    // 1. Fragility Score
    const scores = scoreFragility(absFile);
    const estimatedSteps = scores.length || 0;

    // 2. Initialize DB Run
    const runStmt = db.prepare('INSERT INTO runs (test_file, total_steps, status) VALUES (?, ?, ?)');
    const runResult = runStmt.run(path.basename(absFile), estimatedSteps, 'running');
    const runId = runResult.lastInsertRowid;

    // 3. Start Servers
    const portToUse = process.env.PORT || 3000;
    const { server, port } = createHttpServer(portToUse);
    const io = createWsServer(server); // Bind WS to the Express port
    
    // Phase 4 Fragility Event
    const fragilityResults = scores.map(s => ({
        selector: s.selector,
        score: s.score / 100,
        risk: s.score > 50 ? 'high' : (s.score > 20 ? 'medium' : 'low')
    }));

    io.on('connection', (ws) => {
        ws.send(JSON.stringify({ type: 'fragility:scan', results: fragilityResults }));
    });
    
    await new Promise(resolve => server.listen(port, resolve));
    const url = `http://localhost:${port}`;
    console.log(`  🌐 Dashboard: ${url}`);
    
    // Phase 3: run:start event
    broadcast('run:start', { 
        file: path.basename(absFile), 
        totalSteps: estimatedSteps 
    });

    if (dashboard) open(url);
    if (panel) console.log(`  [VSCODE_WS_PORT=${port}]`);

    // 4. Runner Context
    setRunnerContext({ testFile: absFile, io, runId, stepIndex: 0 });

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    let finalStatus = 'passed';
    console.log(`\n  🚀 Executing tests...`);

    try {
        const testScript = await import('file://' + absFile);
        const testFn = testScript.default || testScript.run;
        await testFn(page, { serverUrl: url });
        console.log(`\n  ✅ All steps complete!`);
    } catch(err) {
        finalStatus = 'failed';
        console.error(`\n  ❌ Test failure:`, err.message);
    }

    // 5. Finalize Run
    db.prepare('UPDATE runs SET status = ?, end_time = CURRENT_TIMESTAMP WHERE id = ?').run(finalStatus, runId);
    
    // Phase 3: run:done event
    const summary = db.prepare(`
        SELECT 
            (SELECT COUNT(*) FROM steps WHERE run_id = ?) as total,
            (SELECT COUNT(*) FROM steps WHERE run_id = ? AND status = 'pass') as passed,
            (SELECT COUNT(*) FROM steps WHERE run_id = ? AND status = 'healed') as healed,
            (SELECT COUNT(*) FROM steps WHERE run_id = ? AND status = 'fail') as failed
    `).get(runId, runId, runId, runId);

    broadcast('run:done', { 
        passed: summary.passed, 
        healed: summary.healed, 
        failed: summary.failed, 
        interventions: 0 
    });

    generateReport(runId);

    if (dashboard || panel) {
        console.log(`\n  🏁 Run complete. ${dashboard ? 'Dashboard' : 'Panel'} active.`);
        console.log(`  Press Ctrl+C to exit.`);
    } else {
        await browser.close();
        closeDb();
        process.exit(finalStatus === 'passed' ? 0 : 1);
    }
}
