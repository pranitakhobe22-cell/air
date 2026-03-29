/**
<<<<<<< HEAD
 * checkout.spec.js -- SelfHeal Live Website Test
 * Run with:
 *   node bin/selfheal.js run tests/checkout.spec.js --dashboard
=======
 * checkout.spec.js — SelfHeal Demo Test
 * ============================================================
 * This test uses INTENTIONALLY BROKEN selectors from the V1 checkout page.
 * The live page (checkout-page.html) has been updated to V2 with new IDs.
 *
 * Broken → Real mapping:
 *   #login-email   → #auth-user-email
 *   #login-password→ #auth-user-pass
 *   #login-btn     → #btn-authenticate
 *   #add-cart      → .action-add-item
 *   #place-order   → #checkout-submit
 *
 * Every step includes an `intent` string that flows all the way into
 * the Gemini prompt as:
 *   "The goal was to [intent]. Find the element that achieves this goal."
 *
 * Run with:  npm run dev
 * ============================================================
>>>>>>> origin/phase-4
 */

import { healClick, healFill, healNavigate } from '../src/sdk/index.js';

<<<<<<< HEAD
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
=======
export default async function checkoutTest(page, { serverUrl }) {
    console.log('\n  ╔══════════════════════════════════════════════════╗');
    console.log('  ║  🛒  SelfHeal Checkout Demo — Broken Selectors  ║');
    console.log('  ╚══════════════════════════════════════════════════╝\n');

    // ── Step 1: Navigate to the checkout page ────────────────────────
    console.log('  ▸ Step 1/6 — Navigate to checkout page');
    await healNavigate(page, `${serverUrl}/pages/checkout-page.html`, {
        intent: 'Navigate to the secure checkout page',
    });

    // ── Step 2: Fill email (BROKEN: was #login-email in V1) ──────────
    console.log('\n  ▸ Step 2/6 — Fill email address');
    await healFill(page, '#auth-user-email', 'alex@example.com', {
        intent: 'Fill the email address field in the login form',
    });

    // ── Step 3: Fill password (BROKEN: was #login-password in V1) ────
    console.log('\n  ▸ Step 3/6 — Fill password');
    await healFill(page, '#login-password', 'securepass123', {
        intent: 'Fill the password field in the login form',
    });

    // ── Step 4: Click login (BROKEN: was #login-btn in V1) ──────────
    console.log('\n  ▸ Step 4/6 — Click login button');
    await healClick(page, '#login-btn', {
        intent: 'Submit the login form to authenticate the user',
    });

    // ── Step 5: Add to cart (BROKEN: was #add-cart in V1) ────────────
    console.log('\n  ▸ Step 5/6 — Add item to cart');
    await healClick(page, '#add-cart', {
        intent: 'Add the SelfHeal Pro License product to the shopping cart',
    });

    // ── Step 6: Place order (BROKEN: was #place-order in V1) ─────────
    console.log('\n  ▸ Step 6/6 — Place order');
    await healClick(page, '#place-order', {
        intent: 'Complete the purchase by clicking the place order button',
    });

    console.log('\n  ╔══════════════════════════════════════════════════╗');
    console.log('  ║  🎉  All 6 steps healed and completed!           ║');
    console.log('  ╚══════════════════════════════════════════════════╝\n');
>>>>>>> origin/phase-4
}
