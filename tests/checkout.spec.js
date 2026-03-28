/**
 * checkout.spec.js -- SelfHeal Live Website Test
 * Run with:
 *   node bin/selfheal.js run tests/checkout.spec.js --dashboard
 */

import { healClick, healFill, healNavigate } from '../src/sdk/index.js';

export default async function checkoutTest(page, { serverUrl, targetUrl } = {}) {
    const url = targetUrl || `${serverUrl}/pages/checkout-page.html`;

    console.log('\n  SelfHeal Live Test - Broken Selectors');
    console.log('  --------------------------------------');
    console.log(`  Target: ${url}\n`);

    // Step 1: Navigate
    console.log('  Step 1/4 - Navigate to website');
    await healNavigate(page, url, {
        intent: 'Navigate to the target website',
    });

    // Step 2: Fill email (broken selector)
    console.log('\n  Step 2/4 - Fill email or username');
    await healFill(page, '#login-email', 'testuser@example.com', {
        intent: 'Fill the email address or username field in the login form',
    });

    // Step 3: Fill password (broken selector)
    console.log('\n  Step 3/4 - Fill password');
    await healFill(page, '#login-password', 'securepass123', {
        intent: 'Fill the password field in the login form',
    });

    // Step 4: Click login (broken selector)
    console.log('\n  Step 4/4 - Click login button');
    await healClick(page, '#login-btn', {
        intent: 'Submit the login form to authenticate the user',
    });

    console.log('\n  --------------------------------------');
    console.log('  All steps completed.\n');
}
