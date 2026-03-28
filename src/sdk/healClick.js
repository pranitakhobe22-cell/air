import { executeStep } from '../runner/playwrightRunner.js';

export async function healClick(page, selector, { intent = null } = {}) {
    await executeStep(
        page, 
        'click', 
        selector, 
        (sel) => page.locator(sel).click({ timeout: 5000 }), 
        intent
    );
}
