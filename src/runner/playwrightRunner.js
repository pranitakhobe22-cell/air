import { watchFailure } from '../watcher/failureWatcher.js';
import { patchTestFile } from '../patcher/patchWriter.js';
import config from '../../selfheal.config.js';

const CONFIDENCE_THRESHOLD = config.healer?.confidenceThreshold ?? 0.80;
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

        const healResult = await watchFailure(page, error, selector, intent, stepHistory);
        emitEvent(io, 'heal:result', healResult);

        if (!healResult.newSelector) {
            emitEvent(io, 'step:heal_failed', { selector });
            throw error;
        }

        // Confidence Logic — threshold from selfheal.config.js
        if (healResult.confidence >= CONFIDENCE_THRESHOLD) {
            console.log(`  ✅ [PlaywrightRunner] Auto-healing: ${selector} → ${healResult.newSelector}`);

            // Use Dev 2's Patch Writer
            if (testFile) patchTestFile(testFile, selector, healResult.newSelector);

            // Retry with the healed selector
            await performPlaywrightAction(healResult.newSelector);

            // Bug 5 fix: Mark step as healed so healReport counts it
            const lastStep = stepHistory[stepHistory.length - 1];
            if (lastStep) lastStep.status = 'healed';

            emitEvent(io, 'step:healed', {
                action,
                selector: healResult.newSelector,
                extra: { rootCause: healResult.rootCause, confidence: healResult.confidence }
            });
        } else {
            console.log(`  ⚠️  Low confidence (${healResult.confidence} < ${CONFIDENCE_THRESHOLD}), human approval required for ${selector}`);
            emitEvent(io, 'heal:confirm', {
                brokenSelector: selector,
                suggestedSelector: healResult.newSelector,
                confidence: healResult.confidence,
                rootCause: healResult.rootCause
            });
            // We would await human approval here
            throw new Error(`Unresolved heal for '${selector}': confidence ${healResult.confidence} < ${CONFIDENCE_THRESHOLD}. Reason: ${healResult.rootCause || 'Unknown'}`);
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
