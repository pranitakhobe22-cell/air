import { healClick, healFill, healNavigate } from '../src/sdk/index.js';

export default async function (page, { serverUrl }) {
  console.log('  📦 Starting check out test using Intent SDK...\n');

  // Step 1: Navigate to the v2 checkout page
  await healNavigate(page, `${serverUrl}/pages/checkout-page.html`);

  // Step 2: Fill email — uses V1 selector (#user-email-field) but gives clear intent
  await healFill(
      page, 
      '#user-email-field', 
      'test@webhealer.dev', 
      { intent: "The primary email address input field for checkout" }
  );

  // Step 3: Fill promo code
  await healFill(
      page, 
      '#discount-code', 
      'SAVE20', 
      { intent: "Optional discount or promo code field" }
  );

  // Step 4: Click place order - terrible fragile selector to demo the fragility scorer
  await healClick(
      page, 
      '#checkout-submit', 
      { intent: "The final checkout / place order submission button" }
  );

  // Step 5: Verify success message
  await healClick(
      page, 
      '#order-confirm-status', 
      { intent: "Order confirmation text block acting as success banner" }
  );

  console.log('  🎉 Intent Checkout test complete!\n');
}
