import { executeStep, getRunnerContext } from '../runner/playwrightRunner.js';

export async function healFill(page, selector, value, { intent = null } = {}) {
    const { testFile, io } = getRunnerContext();
    await executeStep(
        page, 
        'fill', 
        selector, 
        (sel) => page.locator(sel).fill(value, { timeout: 5000 }), 
        intent,
        testFile,
        io
    );
}
