/**
 * playwrightRunner.js — Core Test Step Executor
 * ============================================================
 * Executes individual test steps with the full healing pipeline.
 * Handles confidence gating and human-in-the-loop approval
 * for low-confidence heals via Socket.IO.
 * ============================================================
 */

import { watchFailure } from '../watcher/failureWatcher.js';
import { patchTestFile } from '../patcher/patchWriter.js';
import { saveHeal } from '../storage/healHistory.js';
import config from '../../selfheal.config.js';

const CONFIDENCE_THRESHOLD = config.healer?.confidenceThreshold ?? 0.80;
const SAFE_MODE = config.safeMode ?? false;
const APPROVAL_TIMEOUT_MS = 120000; // 2 minutes to approve before failing

const stepHistory = [];

export function emitEvent(io, event, data) {
    if (io) io.emit(event, data);
}

/**
 * Wait for human approval via Socket.IO.
 * Returns true if approved, false if rejected or timed out.
 */
function waitForApproval(io) {
    if (!io) return Promise.resolve(false);

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log('  [Runner] Approval timed out after 2 minutes');
            resolve(false);
        }, APPROVAL_TIMEOUT_MS);

        // Listen on ALL connected sockets for the approval/rejection
        const handler = (socket) => {
            const onApprove = () => {
                clearTimeout(timeout);
                socket.removeListener('heal:reject', onReject);
                resolve(true);
            };
            const onReject = () => {
                clearTimeout(timeout);
                socket.removeListener('heal:approve', onApprove);
                resolve(false);
            };
            socket.once('heal:approve', onApprove);
            socket.once('heal:reject', onReject);
        };

        // Attach to all existing connections
        const sockets = io.sockets?.sockets;
        if (sockets) {
            for (const [, socket] of sockets) {
                handler(socket);
            }
        }
    });
}

export async function executeStep(page, action, selector, performPlaywrightAction, intent, testFile, io) {
    emitEvent(io, 'step:start', { action, selector, intent, testFile });

    try {
        await performPlaywrightAction(selector);
        stepHistory.push({ action, selector, status: 'pass' });
        emitEvent(io, 'step:pass', { action, selector });
    } catch (error) {
        console.log(`\n  [Runner] Action failed: ${action}('${selector}')`);
        stepHistory.push({ action, selector, status: 'fail' });
        emitEvent(io, 'step:fail', { action, selector, error: error.message });

        // Heal pipeline
        emitEvent(io, 'heal:start', { action, selector });
        const healResult = await watchFailure(page, error, selector, intent, stepHistory);
        emitEvent(io, 'heal:result', healResult);

        if (!healResult.newSelector) {
            emitEvent(io, 'step:heal_failed', { selector });
            throw error;
        }

        // Confidence gate
        if (healResult.confidence >= CONFIDENCE_THRESHOLD) {
            console.log(`  [Runner] Auto-healing: "${selector}" → "${healResult.newSelector}" (${Math.round(healResult.confidence * 100)}%)`);

            await performPlaywrightAction(healResult.newSelector);

            // Update step history
            const lastStep = stepHistory[stepHistory.length - 1];
            if (lastStep) lastStep.status = 'healed';

            // Patch the test file via AST
            if (testFile) patchTestFile(testFile, selector, healResult.newSelector);

            // Persist to SQLite
            saveHeal({
                original_selector: selector,
                healed_selector: healResult.newSelector,
                intent,
                test_file: testFile,
                root_cause: healResult.rootCause,
                confidence: healResult.confidence,
                method: healResult.strategy || 'gemini-ai',
            });

            emitEvent(io, 'step:healed', {
                action,
                selector: healResult.newSelector,
                extra: { rootCause: healResult.rootCause, confidence: healResult.confidence },
            });

        } else if (SAFE_MODE && io) {
            // ── Human-in-the-loop: wait for dashboard approval ──
            console.log(`  [Runner] Low confidence (${(healResult.confidence * 100).toFixed(0)}% < ${CONFIDENCE_THRESHOLD * 100}%)`);
            console.log(`  [Runner] Waiting for human approval via dashboard...`);

            emitEvent(io, 'heal:confirm', {
                action,
                brokenSelector: selector,
                suggestedSelector: healResult.newSelector,
                confidence: healResult.confidence,
                rootCause: healResult.rootCause,
                intent,
            });

            const approved = await waitForApproval(io);

            if (approved) {
                console.log(`  [Runner] Human APPROVED: "${selector}" → "${healResult.newSelector}"`);

                await performPlaywrightAction(healResult.newSelector);

                const lastStep = stepHistory[stepHistory.length - 1];
                if (lastStep) lastStep.status = 'healed';

                if (testFile) patchTestFile(testFile, selector, healResult.newSelector);
                saveHeal({
                    original_selector: selector,
                    healed_selector: healResult.newSelector,
                    intent,
                    test_file: testFile,
                    root_cause: healResult.rootCause,
                    confidence: healResult.confidence,
                    method: 'human-approved',
                });

                emitEvent(io, 'step:healed', {
                    action,
                    selector: healResult.newSelector,
                    extra: { rootCause: healResult.rootCause, confidence: healResult.confidence, humanApproved: true },
                });
            } else {
                console.log(`  [Runner] Human REJECTED or timed out for "${selector}"`);
                throw new Error(
                    `[Runner] Heal rejected/timed-out for "${selector}". ` +
                    `Suggested: "${healResult.newSelector}" (${healResult.confidence}). ` +
                    `Reason: ${healResult.rootCause || 'Unknown'}`
                );
            }

        } else {
            // No safe mode or no IO — throw with diagnostic info
            console.log(`  [Runner] Low confidence (${(healResult.confidence * 100).toFixed(0)}%), no safe mode — failing`);
            throw new Error(
                `[Runner] Confidence too low (${healResult.confidence}) for "${selector}". ` +
                `Suggested: "${healResult.newSelector}". Needs manual approval.`
            );
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
