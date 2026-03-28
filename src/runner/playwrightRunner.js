/**
 * src/runner/playwrightRunner.js
 * ============================================================
 * Executes a Playwright test file step-by-step.
 *
 * Responsibilities
 * ─────────────────
 *  • Wrap every step in try/catch — never let a raw crash surface.
 *  • On failure: capture context → call heal engine → re-run with fix.
 *  • Respect config.maxRetries and config.confidenceThreshold.
 *  • Emit fine-grained lifecycle events on a shared EventEmitter so
 *    the dashboard, CLI, and reporter can all listen without coupling.
 *
 * Events emitted
 * ─────────────────
 *  step:start  { stepIndex, stepCode, testFile }
 *  step:pass   { stepIndex, stepCode, durationMs }
 *  step:fail   { stepIndex, stepCode, error, attemptNumber }
 *  heal:start  { stepIndex, attemptNumber, failureBundle }
 *  heal:done   { stepIndex, attemptNumber, healResult }
 *  run:done    { testFile, passed, failed, healed, durationMs, steps }
 *
 * Teammate contract (wire shape agreed with Dev 2)
 * ─────────────────
 *  failureBundle  →  { error, selector, domSnapshot, networkLogs,
 *                      consoleErrors, recentSteps, screenshotBase64 }
 *  healResult     ←  { rootCause, newSelector, confidence }
 *
 * The mock heal agent below returns this exact shape so the real
 * healAgent.js can be swapped in with zero changes to this file.
 * ============================================================
 */

import { EventEmitter } from "events";
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";

// ─────────────────────────────────────────────────────────────
// SECTION 1 — MOCK HEAL AGENT
// ─────────────────────────────────────────────────────────────
// Returns the teammate's wire shape: { rootCause, newSelector, confidence }.
// Replace this import with the real healAgent once it is ready:
//   import { healAgent } from '../agent/healAgent.js';

/**
 * Mock heal agent.
 * Simulates a confident fix so the runner pipeline can be exercised end-to-end.
 *
 * @param {Object} failureBundle  - Teammate's wire bundle shape.
 * @returns {Promise<{ rootCause: string, newSelector: string, confidence: number }>}
 */
async function mockHealAgent(failureBundle) {
  // Simulate async network / LLM latency
  await new Promise((r) => setTimeout(r, 120));

  const original = failureBundle.selector ?? "";

  // Produce a plausible-looking healed selector for testing purposes.
  // Real healAgent.js will do DOM analysis + Gemini call here.
  const healed = original
    ? original.replace(/^#/, "[data-testid='") + (original.startsWith("#") ? "']" : "")
    : "[data-testid='healed-element']";

  return {
    rootCause: `Mock: selector "${original}" no longer matches the DOM.`,
    newSelector: healed,
    confidence: 0.92, // above default threshold of 0.8
  };
}

<<<<<<< Updated upstream
// ─────────────────────────────────────────────────────────────
// SECTION 2 — MOCK FAILURE WATCHER
// ─────────────────────────────────────────────────────────────
// Replace with the real failureWatcher once ready:
//   import { recordFailure } from '../watcher/failureWatcher.js';

/**
 * Mock failure watcher — logs the bundle to a JSON file in /tmp.
 * @param {Object} bundle
 */
async function mockFailureWatcher(bundle) {
  try {
    const dir = path.join(process.cwd(), ".selfheal-failures");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `failure-${Date.now()}.json`);
    await fs.writeFile(file, JSON.stringify(bundle, null, 2), "utf8");
  } catch {
    // Non-fatal — watcher must never throw into the runner
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 3 — HELPER UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Extract a CSS selector string from a step's source code.
 * Handles: page.click('#foo'), page.fill('.bar', …), page.locator('…'), etc.
 * Returns an empty string when no selector can be detected.
 *
 * @param {string} stepCode
 * @returns {string}
 */
function extractSelector(stepCode) {
  const m = stepCode.match(/(?:click|fill|locator|waitFor|check|uncheck|selectOption)\(\s*(['"`])(.+?)\1/);
  return m ? m[2] : "";
}

/**
 * Capture a base-64 encoded PNG screenshot from the current page.
 * Returns an empty string if the page is not available.
 *
 * @param {import('playwright').Page|null} page
 * @returns {Promise<string>}
 */
async function captureScreenshotBase64(page) {
  if (!page) return "";
  try {
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    return buffer.toString("base64");
  } catch {
    return "";
  }
}

/**
 * Capture a DOM snapshot (full HTML) from the current page.
 * Returns an empty string if the page is not available.
 *
 * @param {import('playwright').Page|null} page
 * @returns {Promise<string>}
 */
async function captureDomSnapshot(page) {
  if (!page) return "";
  try {
    return await page.content();
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 4 — STEP EXECUTOR
// ─────────────────────────────────────────────────────────────

/**
 * Execute a single step function, applying the optional healed selector.
 *
 * When `newSelector` is provided the step's original selector string is
 * replaced in the source before eval so the healed selector is used.
 * This is intentionally simple — the real patcher (src/patcher/) will
 * handle AST-level rewriting when safeMode is off.
 *
 * @param {Function}                      stepFn       - The step to run.
 * @param {import('playwright').Page}     page         - Active Playwright page.
 * @param {string}                        originalCode - Source code of the step (for display).
 * @param {string|null}                   newSelector  - Replacement selector if healing.
 * @param {number}                        timeoutMs    - Per-step timeout in milliseconds.
 * @returns {Promise<void>}
 */
async function executeStep(stepFn, page, originalCode, newSelector, timeoutMs) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Step timed out after ${timeoutMs}ms: ${originalCode}`)), timeoutMs)
  );
  await Promise.race([stepFn(page, newSelector), timeout]);
}

// ─────────────────────────────────────────────────────────────
// SECTION 5 — PLAYWRIGHT RUNNER CLASS
// ─────────────────────────────────────────────────────────────

export class PlaywrightRunner extends EventEmitter {
  /**
   * @param {Object}  config
   * @param {number}  config.maxRetries            - Max heal attempts per step.
   * @param {number}  config.confidenceThreshold   - Min confidence to accept a heal.
   * @param {boolean} config.safeMode              - Log fixes only; don't re-run.
   * @param {number}  config.stepTimeoutMs         - Per-step timeout ms.
   * @param {Function} [config.healAgent]          - Override the heal agent (for testing).
   * @param {Function} [config.failureWatcher]     - Override the failure watcher (for testing).
   */
  constructor(config = {}) {
    super();

    this.maxRetries = config.maxRetries ?? 3;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.8;
    this.safeMode = config.safeMode ?? false;
    this.stepTimeoutMs = config.stepTimeoutMs ?? 10_000;

    // Allow injection for unit-testing with a custom mock
    this._healAgent = config.healAgent ?? mockHealAgent;
    this._failureWatcher = config.failureWatcher ?? mockFailureWatcher;
  }

  // ── 5a. Main entry point ───────────────────────────────────

  /**
   * Run a test file that exports an array of step functions.
   *
   * Expected test file shape:
   * ```js
   * export const testName = "Login › should log in";
   * export const steps = [
   *   async (page) => { await page.goto('https://example.com'); },
   *   async (page) => { await page.click('#login-btn'); },
   * ];
   * ```
   *
   * @param {string} testFile - Absolute path to the test module.
   * @returns {Promise<RunSummary>}
   */
  async run(testFile) {
    const runStart = Date.now();

    // ── Load the test module dynamically ──────────────────────
    let testModule;
    try {
      testModule = await import(testFile);
    } catch (err) {
      throw new Error(`[playwrightRunner] Cannot load test file: ${testFile}\n${err.message}`);
=======
export async function executeStep(page, action, selector, performPlaywrightAction, intent, testFile, io) {
    emitEvent(io, 'step:start', { action, selector, testFile });
    
    // Capture logs
    const consoleErrors = [];
    const networkLogs = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('requestfailed', req => networkLogs.push(`${req.url()}: ${req.failure().errorText}`));

    try {
        await performPlaywrightAction(selector);
        stepHistory.push({ action, selector, status: 'pass' });
        emitEvent(io, 'step:pass', { action, selector });
    } catch (error) {
        console.log(`\n  ❌ [PlaywrightRunner] Action failed: ${action}('${selector}')`);
        stepHistory.push({ action, selector, status: 'fail' });
        emitEvent(io, 'step:fail', { action, selector, error: error.message });
        
        // Screenshot support
        let screenshotBase64 = '';
        try {
            screenshotBase64 = (await page.screenshot()).toString('base64');
        } catch (e) { /* ignore */ }

        // Start healing
        emitEvent(io, 'heal:start', { action, selector });
        const ctx = await captureFailureContext(page, error, selector, intent, stepHistory);
        
        const failureBundle = {
            ...ctx,
            consoleErrors,
            networkLogs,
            screenshotBase64
        };
        
        // Use Dev 1's Heal Engine
        const healResult = await askHealAgent(failureBundle);
        emitEvent(io, 'heal:result', healResult);

        // Final key mapping (handling both camelCase and snake_case for safety)
        const newSelector = healResult.new_selector || healResult.newSelector;
        const confidence = healResult.confidence;
        const rootCause = healResult.root_cause || healResult.rootCause;

        if (!newSelector) {
            emitEvent(io, 'step:heal_failed', { selector });
            throw error;
        }

        if (confidence >= 0.8) {
            console.log(`  ✅ [PlaywrightRunner] Auto-healing: ${selector} → ${newSelector}`);
            
            // Use Dev 2's Patch Writer
            if (testFile) patchTestFile(testFile, selector, newSelector);

            // Retry the act
            await performPlaywrightAction(newSelector);
            emitEvent(io, 'step:healed', { 
                action, 
                selector: newSelector, 
                extra: { root_cause: rootCause, confidence: confidence } 
            });
        } else {
            console.log(`  ⚠️  Low confidence (${confidence.toFixed(2)}), human approval required for ${selector}`);
            emitEvent(io, 'heal:confirm', { 
                brokenSelector: selector, 
                suggestedSelector: newSelector, 
                confidence: confidence, 
                rootCause: rootCause 
            });
            throw new Error(`Unresolved heal: ${confidence} < 0.8 conf`);
        }
>>>>>>> Stashed changes
    }

    const testName = testModule.testName ?? path.basename(testFile, ".js");
    const steps = testModule.steps;

    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error(`[playwrightRunner] Test file must export a non-empty "steps" array: ${testFile}`);
    }

    // ── Launch browser ────────────────────────────────────────
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Collect console messages for the failure bundle
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Collect failed network requests for the failure bundle
    const networkLogs = [];
    page.on("requestfailed", (req) => {
      networkLogs.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? "unknown"}`);
    });

    // ── Run steps ─────────────────────────────────────────────
    const stepSummaries = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalHealed = 0;
    const recentSteps = []; // last N step codes for context

    for (let i = 0; i < steps.length; i++) {
      const stepFn = steps[i];
      const stepCode = stepFn.toString(); // source for display & bundle
      let stepResult = await this._runStep({
        stepFn,
        stepCode,
        stepIndex: i,
        testFile,
        testName,
        page,
        consoleErrors,
        networkLogs,
        recentSteps: [...recentSteps],
      });

      recentSteps.push(stepCode);
      if (recentSteps.length > 5) recentSteps.shift(); // rolling window

      stepSummaries.push(stepResult);
      if (stepResult.status === "pass" || stepResult.status === "healed") totalPassed++;
      if (stepResult.status === "fail") totalFailed++;
      if (stepResult.status === "healed") totalHealed++;

      // Abort remaining steps on unrecoverable failure
      if (stepResult.status === "fail") {
        for (let j = i + 1; j < steps.length; j++) {
          stepSummaries.push({ stepIndex: j, status: "skipped", stepCode: steps[j].toString() });
        }
        break;
      }
    }

    await browser.close();

    const summary = {
      testFile,
      testName,
      passed: totalPassed,
      failed: totalFailed,
      healed: totalHealed,
      total: steps.length,
      durationMs: Date.now() - runStart,
      steps: stepSummaries,
    };

    this.emit("run:done", summary);
    return summary;
  }

  // ── 5b. Single-step lifecycle (with heal loop) ─────────────

  /**
   * Run one step, healing up to maxRetries times on failure.
   *
   * @private
   */
  async _runStep({ stepFn, stepCode, stepIndex, testFile, testName, page, consoleErrors, networkLogs, recentSteps }) {
    this.emit("step:start", { stepIndex, stepCode, testFile });

    let lastError = null;
    let currentSelector = extractSelector(stepCode);
    let currentNewSelector = null; // set after a successful heal

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const stepStart = Date.now();

      try {
        await executeStep(stepFn, page, stepCode, currentNewSelector, this.stepTimeoutMs);

        const durationMs = Date.now() - stepStart;

        if (attempt === 1) {
          // Clean pass — no healing needed
          this.emit("step:pass", { stepIndex, stepCode, durationMs });
          return { stepIndex, status: "pass", stepCode, durationMs };
        } else {
          // Passed after healing
          this.emit("step:pass", { stepIndex, stepCode: currentNewSelector ?? stepCode, durationMs });
          return { stepIndex, status: "healed", stepCode, healedSelector: currentNewSelector, durationMs };
        }
      } catch (err) {
        lastError = err;

        this.emit("step:fail", {
          stepIndex,
          stepCode,
          error: err,
          attemptNumber: attempt,
        });

        // ── Build the failure bundle (teammate's wire shape) ──
        const screenshotBase64 = await captureScreenshotBase64(page);
        const domSnapshot = await captureDomSnapshot(page);

        const failureBundle = {
          error: {
            message: err.message,
            stack: err.stack ?? "",
          },
          selector: currentSelector,
          domSnapshot,
          networkLogs: [...networkLogs],
          consoleErrors: [...consoleErrors],
          recentSteps,
          screenshotBase64,
          // Extra context (aligned with CONTRACT.js for future compatibility)
          _meta: {
            testFile,
            testName,
            stepCode,
            attemptNumber: attempt,
            timestamp: new Date().toISOString(),
          },
        };

        // Record the failure asynchronously (non-blocking)
        this._failureWatcher(failureBundle).catch(() => {});

        // ── Only attempt healing if retries remain ─────────────
        if (attempt >= this.maxRetries) break;

        this.emit("heal:start", { stepIndex, attemptNumber: attempt, failureBundle });

        let healResult;
        try {
          healResult = await this._healAgent(failureBundle);
        } catch (healErr) {
          // Heal engine itself crashed — log and give up
          healResult = { rootCause: healErr.message, newSelector: "", confidence: 0 };
        }

        this.emit("heal:done", { stepIndex, attemptNumber: attempt, healResult });

        // ── Validate the heal ──────────────────────────────────
        const isTrustworthy =
          healResult.confidence >= this.confidenceThreshold && healResult.newSelector;

        if (!isTrustworthy) {
          // Not confident enough — keep retrying without changing selector
          continue;
        }

        if (this.safeMode) {
          // Safe mode: log the fix, do NOT apply it, count as failure
          console.warn(
            `[selfheal] safeMode: heal found for step ${stepIndex + 1} ` +
            `(confidence ${healResult.confidence}) but not applied.\n` +
            `  rootCause:   ${healResult.rootCause}\n` +
            `  newSelector: ${healResult.newSelector}`
          );
          break;
        }

        // ── Apply the heal: update the active selector ─────────
        currentNewSelector = healResult.newSelector;
        currentSelector = healResult.newSelector;

        // Continue the loop — next iteration re-runs the step
        // with the new selector injected via executeStep()
      }
    } // end retry loop

    // ── Exhausted all retries ──────────────────────────────────
    return {
      stepIndex,
      status: "fail",
      stepCode,
      error: {
        message: lastError?.message ?? "Unknown error",
        stack: lastError?.stack ?? "",
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 6 — CONVENIENCE FACTORY
// ─────────────────────────────────────────────────────────────

/**
 * Create and run a PlaywrightRunner in one call.
 *
 * @param {string} testFile   - Absolute path to the test module.
 * @param {Object} [config]   - Runner config (see PlaywrightRunner constructor).
 * @returns {Promise<{ runner: PlaywrightRunner, summary: RunSummary }>}
 *
 * @example
 * const { runner, summary } = await createAndRun('/abs/path/test.js', config);
 * runner.on('step:fail', ({ stepCode, error }) => console.error(stepCode, error));
 */
export async function createAndRun(testFile, config = {}) {
  const runner = new PlaywrightRunner(config);
  const summary = await runner.run(testFile);
  return { runner, summary };
}

export default PlaywrightRunner;
