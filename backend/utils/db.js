/**
 * AERIS – Database Provider
 * ────────────────────────────────────────────────────────────────
 * Centralized DB accessor. Now uses Firebase Admin SDK.
 */

const { db } = require('../config/firebase');

console.log('📦 [AERIS DB] Firebase Admin DB Initialized.');

module.exports = db;
