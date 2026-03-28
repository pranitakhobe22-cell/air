import { executeStep, getRunnerContext } from '../runner/playwrightRunner.js';

export async function healNavigate(page, url, { intent = null } = {}) {
    const { testFile, io } = getRunnerContext();
    await executeStep(
        page, 
        'goto', 
        url, 
        (sel) => page.goto(sel, { waitUntil: 'domcontentloaded' }), 
        intent,
        testFile,
        io
    );
}
