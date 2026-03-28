/**
 * SelfHeal SDK — Public API
 *
 * Usage:
 *   import { healClick, healFill, healNavigate } from 'selfheal/src/sdk/index.js';
 *
 *   await healClick(page, '#login-btn', { intent: 'log the user in' });
 *   await healFill(page, '#email', 'user@test.com', { intent: 'enter email address' });
 *   await healNavigate(page, 'https://app.example.com/checkout', { intent: 'go to checkout' });
 */

export { healClick } from './healClick.js';
export { healFill } from './healFill.js';
export { healNavigate } from './healNavigate.js';
