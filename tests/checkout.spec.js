/**
 * checkout.spec.js — SelfHeal Demo Test (Phase 3 "ShopFlow" UI Edition)
 * ============================================================
 * This test uses INTENTIONALLY BROKEN selectors from a hypothetical V1 site.
 * The live page (checkout-page.html) is "ShopFlow V2" with new IDs.
 *
 * Broken → Real mapping:
 *   #email-input      → #contact-email
 *   #first-name       → #shipping-first
 *   #credit-card-num  → #card-number
 *   #promo-input      → #voucher-code
 *   .submit-order-btn → #btn-place-order
 *
 * Every step includes an `intent` string that flows into the Gemini prompt:
 *   "The goal was to [intent]. Find the element that achieves this goal."
 *
 * Run with:  npm run dev
 * ============================================================
 */

import { healClick, healFill, healNavigate } from '../src/sdk/index.js';

export default async function checkoutTest(page, { serverUrl }) {
    console.log('\n  ╔══════════════════════════════════════════════════╗');
    console.log('  ║  🛒  ShopFlow Checkout Demo — Broken Selectors   ║');
    console.log('  ╚══════════════════════════════════════════════════╝\n');

    // ── Step 1: Navigate to the checkout page ────────────────────────
    console.log('  ▸ Step 1/6 — Navigate to checkout page');
    await healNavigate(page, `${serverUrl}/pages/checkout-page.html`, {
        intent: 'Navigate to the secure checkout page',
    });

    // ── Step 2: Fill email (BROKEN: was #email-input) ──────────
    console.log('\n  ▸ Step 2/6 — Fill email address');
    await healFill(page, '#contact-email', 'alex@example.com', {
        intent: 'Fill the contact email address for order notifications',
    });

    // ── Step 3: Fill first name (BROKEN: was #first-name) ────
    console.log('\n  ▸ Step 3/6 — Fill first name');
    await healFill(page, '#shipping-first', 'Alex', {
        intent: 'Fill the first name field in the shipping address section',
    });

    // ── Step 4: Fill card number (BROKEN: was #credit-card-num) ──────────
    console.log('\n  ▸ Step 4/6 — Fill credit card number');
    await healFill(page, '#card-number', '4242424242424242', {
        intent: 'Enter the 16-digit credit card number in the payment details',
    });

    // ── Step 5: Fill voucher (BROKEN: was #promo-input) ────────────
    console.log('\n  ▸ Step 5/6 — Apply discount promo');
    await healFill(page, '#voucher-code', 'SAVE20', {
        intent: 'Enter the promo voucher code to apply a discount',
    });

    // ── Step 6: Place order (BROKEN: was .submit-order-btn) ─────────
    console.log('\n  ▸ Step 6/6 — Place order');
    await healClick(page, '#btn-place-order', {
        intent: 'Complete the purchase by clicking the main place order submit button',
    });

    console.log('\n  ╔══════════════════════════════════════════════════╗');
    console.log('  ║  🎉  All 6 ShopFlow steps healed and completed!  ║');
    console.log('  ╚══════════════════════════════════════════════════╝\n');
}
