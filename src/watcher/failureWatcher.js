import { askHealAgent } from '../agent/healAgent.js';
import { scanDomForHeal } from '../selector/selectorEngine.js';

export async function watchFailure(page, error, selector, intent, stepHistory = []) {
    // 1. Capture DOM snapshot
    let domSnapshot = "";
    try {
        domSnapshot = await page.content();
    } catch (e) {
        domSnapshot = "<html><body>Failed to capture DOM</body></html>";
    }

    // 2. Capture real screenshot (base64) from Playwright page
    let screenshotBase64 = "";
    try {
        screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: true });
    } catch (e) {
        console.warn("[Watcher] ⚠️  Could not capture screenshot:", e.message);
        screenshotBase64 = "";
    }

    // 3. Capture console errors if the page context is still alive
    //    (Playwright doesn't expose historical console logs retroactively,
    //     so this relies on listeners set earlier or returns an empty array)
    const consoleErrors = [];
    const networkLogs = [];

    const recentSteps = stepHistory.slice(-5);

    const failureBundle = {
        error: error.message,
        selector,
        intent,
        domSnapshot,
        networkLogs,
        consoleErrors,
        recentSteps,
        screenshotBase64
    };

    console.log(`\n[Watcher] 🕵️  Captured failure for selector: '${selector}'`);
    console.log("[Watcher] 🔍 Running local selectorEngine scan...");

    // Attempt local engine resolution first
    const localHeal = scanDomForHeal(failureBundle);

    if (localHeal.confidence >= 0.8) {
        console.log(`[Watcher] ⚡ Local Engine resolved with high confidence (${localHeal.confidence})`);
        return localHeal;
    }

    console.log(`[Watcher] ⚠️  Local confidence too low (${localHeal.confidence}). Falling back to Gemini 2.5 Flash...`);
    const aiHeal = await askHealAgent(failureBundle);
    return aiHeal;
}
