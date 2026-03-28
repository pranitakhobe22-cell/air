import { healClick, healFill, healNavigate } from '../src/sdk/index.js';

export default async function (page, { serverUrl }) {
  console.log('  📦 Starting check out test using Intent SDK...\n');

  // Step 1: Navigate to the v2 shop page
  await healNavigate(page, `${serverUrl}/pages/shop_v2.html`);

  // Step 2: Fill email — uses V1 selector (#email-input) but gives clear intent
  await healFill(
      page, 
      '#email-input', 
      'test@webhealer.dev', 
      { intent: "The primary email address input field for checkout" }
  );

  // Step 3: Fill promo code
  await healFill(
      page, 
      '#promo-input', 
      'SAVE20', 
      { intent: "Optional discount or promo code field" }
  );

  // Step 4: Click place order - terrible fragile selector to demo the fragility scorer
  await healClick(
      page, 
      'body > div.form-group:nth-child(4) > button', 
      { intent: "The final checkout / place order submission button" }
  );

  // Step 5: Verify success message
  await healClick(
      page, 
      '#success-msg', 
      { intent: "Order confirmation text block acting as success banner" }
  );

  console.log('  🎉 Intent Checkout test complete!\n');
}
