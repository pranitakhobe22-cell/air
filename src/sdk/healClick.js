/**
 * healClick.js — SDK wrapper for self-healing page.click()
 *
 * Flow:
 *   1. Check SQLite cache (instant — no AI)
 *   2. Try original selector
 *   3. On failure → failureWatcher bundles context → selectorEngine tries locally → Gemini fallback
 *   4. Confidence ≥ threshold → auto-apply fix, retry click, persist to DB, patch source
 *   5. Confidence < threshold + safeMode → log warning, emit confirm event for human review
 */

import { watchFailure } from '../watcher/failureWatcher.js';
import { findCachedHeal, saveHeal } from '../storage/healHistory.js';
import { getRunnerContext, emitEvent, getStepHistory } from '../runner/playwrightRunner.js';
import { patchTestFile } from '../patcher/patchWriter.js';
import config from '../../selfheal.config.js';

export async function healClick(page, selector, { intent = null } = {}) {
    const { io, testFile } = getRunnerContext();
    const threshold = config.healer?.confidenceThreshold ?? 0.8;
    const safeMode  = config.safeMode ?? false;

    emitEvent(io, 'step:start', { action: 'click', selector, intent, testFile });

    // ── 1. SQLite Cache — skip AI entirely on repeat runs ────────────
    const cachedFix = findCachedHeal(selector, intent);
    if (cachedFix && cachedFix.healed_selector) {
        console.log(`  ⚡ [healClick] Cache hit: "${selector}" → "${cachedFix.healed_selector}"`);
        try {
            await page.click(cachedFix.healed_selector, { timeout: 5000 });
            emitEvent(io, 'step:pass', { action: 'click (cached)', selector: cachedFix.healed_selector });
            return;
        } catch (_cacheErr) {
            // Cached selector is stale — fall through to live healing
            console.log(`  ⚠️  [healClick] Cached selector stale, re-healing...`);
        }
    }

    // ── 2. Try the original selector ─────────────────────────────────
    try {
        await page.click(selector, { timeout: 5000 });
        getStepHistory().push({ action: 'click', selector, status: 'pass' });
        emitEvent(io, 'step:pass', { action: 'click', selector });
        return;
    } catch (err) {
        console.log(`\n  ❌ [healClick] Failed: page.click("${selector}")`);
        console.log(`     Error: ${err.message.split('\n')[0]}`);
        getStepHistory().push({ action: 'click', selector, status: 'fail' });
        emitEvent(io, 'step:fail', { action: 'click', selector, error: err.message });

        // ── 3. Heal pipeline: bundle → local engine → Gemini ─────────
        emitEvent(io, 'heal:start', { action: 'click', selector, intent });

        const healResult = await watchFailure(page, err, selector, intent, getStepHistory());
        emitEvent(io, 'heal:result', healResult);

        if (!healResult.newSelector) {
            console.log(`  💀 [healClick] No fix found for "${selector}"`);
            throw err;
        }

        // ── 4. Confidence gate ───────────────────────────────────────
        if (healResult.confidence >= threshold) {
            console.log(`  ✅ [healClick] Healed: "${selector}" → "${healResult.newSelector}" (${Math.round(healResult.confidence * 100)}%)`);

            // Retry with the healed selector
            await page.click(healResult.newSelector, { timeout: 5000 });

            // Update step history
            const lastStep = getStepHistory()[getStepHistory().length - 1];
            if (lastStep) lastStep.status = 'healed';

            emitEvent(io, 'step:healed', {
                action: 'click',
                selector: healResult.newSelector,
                extra: { rootCause: healResult.rootCause, confidence: healResult.confidence },
            });

            // Patch the test source via AST rewrite
            if (testFile) patchTestFile(testFile, selector, healResult.newSelector);

            // Persist to SQLite so the next run skips AI
            saveHeal({
                original_selector: selector,
                healed_selector:   healResult.newSelector,
                intent,
                test_file:    testFile,
                root_cause:   healResult.rootCause,
                confidence:   healResult.confidence,
            });

        } else {
            // ── 5. Safe mode: low confidence — needs human approval ──
            console.log(`  ⚠️  [healClick] Low confidence (${(healResult.confidence * 100).toFixed(0)}% < ${threshold * 100}%)`);
            console.log(`     Suggestion: "${selector}" → "${healResult.newSelector}"`);
            console.log(`     Root cause: ${healResult.rootCause}`);

            emitEvent(io, 'heal:confirm', {
                action:            'click',
                brokenSelector:    selector,
                suggestedSelector: healResult.newSelector,
                confidence:        healResult.confidence,
                rootCause:         healResult.rootCause,
                intent,
            });

            if (safeMode) {
                console.log(`  🔒 [healClick] Safe mode ON — blocking until human confirms.`);
            }

            throw new Error(
                `[healClick] Confidence too low (${healResult.confidence}) for "${selector}". ` +
                `Suggested: "${healResult.newSelector}". Needs manual approval.`
            );
        }
    }
}
