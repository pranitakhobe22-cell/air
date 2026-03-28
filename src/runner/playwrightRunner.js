import { watchFailure } from '../watcher/failureWatcher.js';
import { patchTestFile } from '../patcher/patchWriter.js';
import config from '../../selfheal.config.js';
import db from '../storage/db.js';
import * as healHistory from '../db/healHistory.js';

const CONFIDENCE_THRESHOLD = config.healer?.confidenceThreshold ?? 0.80;

// Global runner context
let runnerContext = { 
    testFile: null, 
    io: null, 
    runId: null, 
    stepIndex: 0 
};

export function setRunnerContext(ctx) {
    runnerContext = { ...runnerContext, ...ctx };
}

export function resetRunnerContext() {
    runnerContext = { testFile: null, io: null, runId: null, stepIndex: 0 };
}

export function getRunnerContext() {
    return runnerContext;
}

export function emitEvent(io, event, data) {
    if (io) io.emit(event, data);
}

export async function executeStep(page, action, selector, performPlaywrightAction, intent) {
    const { testFile, io, runId } = runnerContext;
    const stepIndex = runnerContext.stepIndex++;

    emitEvent(io, 'step:start', { index: stepIndex, name: `${action} ${selector}` });

    // Save step to DB
    const stepStmt = db.prepare('INSERT INTO steps (run_id, step_index, name, status) VALUES (?, ?, ?, ?)');
    const stepResult = stepStmt.run(runId, stepIndex, `${action} ${selector}`, 'running');
    const stepId = stepResult.lastInsertRowid;

    try {
        await performPlaywrightAction(selector);
        
        // Update DB
        db.prepare('UPDATE steps SET status = ? WHERE id = ?').run('pass', stepId);
        
        emitEvent(io, 'step:pass', { index: stepIndex });
    } catch (error) {
        console.log(`\n  ❌ [PlaywrightRunner] Action failed: ${action}('${selector}')`);
        
        // Update DB
        db.prepare('UPDATE steps SET status = ?, error = ? WHERE id = ?').run('fail', error.message, stepId);
        
        emitEvent(io, 'step:fail', { index: stepIndex, error: error.message });

        // Phase 3 Heal Cache Check
        const cachedHeal = healHistory.getPastHeal({ file: testFile, selector });
        let healResult;

        if (cachedHeal && cachedHeal.confidence >= CONFIDENCE_THRESHOLD) {
            console.log(`  ⚡ [PlaywrightRunner] Found cached fix for ${selector} → ${cachedHeal.newSelector}`);
            healResult = cachedHeal;
        } else {
            emitEvent(io, 'heal:start', { index: stepIndex });
            healResult = await watchFailure(page, error, selector, intent, []);
            
            if (healResult.newSelector && healResult.confidence >= CONFIDENCE_THRESHOLD) {
                healHistory.saveHeal({
                    file: testFile,
                    originalSelector: selector,
                    newSelector: healResult.newSelector,
                    confidence: healResult.confidence
                });
            }
        }
        
        if (!healResult.newSelector) {
            emitEvent(io, 'heal:done', { index: stepIndex, healed: false });
            throw error;
        }

        // emit heal:reason
        emitEvent(io, 'heal:reason', {
            rootCause: healResult.rootCause || 'Cached fix applied',
            newSelector: healResult.newSelector,
            confidence: healResult.confidence
        });

        // Confidence Logic
        if (healResult.confidence >= CONFIDENCE_THRESHOLD) {
            console.log(`  ✅ [PlaywrightRunner] Auto-healing: ${selector} → ${healResult.newSelector}`);

            if (testFile) patchTestFile(testFile, selector, healResult.newSelector);

            // Retry
            await performPlaywrightAction(healResult.newSelector);

            // Update DB for Step
            db.prepare('UPDATE steps SET status = ? WHERE id = ?').run('healed', stepId);
            
            // Save Heal to DB
            db.prepare(`
                INSERT INTO heals (step_id, run_id, original_selector, healed_selector, root_cause, confidence, healed)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(stepId, runId, selector, healResult.newSelector, healResult.rootCause, healResult.confidence, 1);

            emitEvent(io, 'heal:done', { index: stepIndex, newSelector: healResult.newSelector, healed: true });
            emitEvent(io, 'step:pass', { index: stepIndex, healed: true });
        } else {
            console.log(`  ⚠️  Low confidence (${healResult.confidence} < ${CONFIDENCE_THRESHOLD}), human approval required`);
            
            // Update DB
            db.prepare(`
                INSERT INTO heals (step_id, run_id, original_selector, healed_selector, root_cause, confidence, healed)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(stepId, runId, selector, healResult.newSelector, healResult.rootCause, healResult.confidence, 0);

            emitEvent(io, 'heal:done', { index: stepIndex, healed: false });
            throw new Error(`Unresolved heal: low confidence`);
        }
    }
}
