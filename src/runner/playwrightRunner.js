import { captureFailureContext } from '../healEngine/failureWatcher.js';
import { askHealAgent } from '../healEngine/healAgent.js';
import { patchTestFile } from './patchWriter.js';

const stepHistory = [];

export function emitEvent(io, event, data) {
    if (io) io.emit(event, data);
}

export async function executeStep(page, action, selector, performPlaywrightAction, intent, testFile, io) {
    emitEvent(io, 'step:start', { action, selector, testFile });
    
    try {
        await performPlaywrightAction(selector);
        stepHistory.push({ action, selector, status: 'pass' });
        emitEvent(io, 'step:pass', { action, selector });
    } catch (error) {
        console.log(`\n  ❌ [PlaywrightRunner] Action failed: ${action}('${selector}')`);
        stepHistory.push({ action, selector, status: 'fail' });
        emitEvent(io, 'step:fail', { action, selector, error: error.message });
        
        // Use Dev 1's Failure Watcher
        emitEvent(io, 'heal:start', { action, selector });
        const ctx = await captureFailureContext(page, error, selector, intent, stepHistory);
        
        // Use Dev 1's Heal Engine
        const healResult = await askHealAgent(ctx);
        emitEvent(io, 'heal:result', healResult);

        if (!healResult.new_selector) {
            emitEvent(io, 'step:heal_failed', { selector });
            throw error;
        }

        // Confidence Logic...
        if (healResult.confidence >= 0.8) {
            console.log(`  ✅ [PlaywrightRunner] Auto-healing: ${selector} → ${healResult.new_selector}`);
            
            // Use Dev 2's Patch Writer
            if (testFile) patchTestFile(testFile, selector, healResult.new_selector);

            // Retry
            await performPlaywrightAction(healResult.new_selector);
            emitEvent(io, 'step:healed', { 
                action, 
                selector: healResult.new_selector, 
                extra: { root_cause: healResult.root_cause, confidence: healResult.confidence } 
            });
        } else {
            console.log(`  ⚠️  Low confidence, human approval required for ${selector}`);
            emitEvent(io, 'heal:confirm', { 
                brokenSelector: selector, 
                suggestedSelector: healResult.new_selector, 
                confidence: healResult.confidence, 
                rootCause: healResult.root_cause 
            });
            // We would await human approval here
            throw new Error(`Unresolved heal: ${healResult.confidence} < 0.8 conf`);
        }
    }
}

export function getStepHistory() { return stepHistory; }

let runnerContext = { testFile: null, io: null };

export function setRunnerContext({ testFile, io }) {
    runnerContext.testFile = testFile;
    runnerContext.io = io;
}

export function getRunnerContext() {
    return runnerContext;
}
