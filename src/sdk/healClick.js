import { executeStep, getRunnerContext } from '../runner/playwrightRunner.js';

export async function healClick(page, selector, { intent = null } = {}) {
    const { testFile, io } = getRunnerContext();
    await executeStep(
        page, 
        'click', 
        selector, 
        (sel) => page.locator(sel).click({ timeout: 5000 }), 
        intent,
        testFile,
        io
    );
}
