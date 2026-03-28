/**
 * selfheal.config.js
 * ============================================================
 * Central configuration for the SelfHeal framework.
 *
 * Resolution order (highest priority first):
 *   1. Environment variables (set in .env or the shell)
 *   2. Hardcoded defaults below
 *
 * Import this module anywhere you need config:
 *   import config from './selfheal.config.js';
 * ============================================================
 */

import "dotenv/config"; // loads .env into process.env

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Parse an env var as an integer, falling back to `defaultValue`. */
function envInt(key, defaultValue) {
  const raw = process.env[key];
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/** Parse an env var as a float, falling back to `defaultValue`. */
function envFloat(key, defaultValue) {
  const raw = process.env[key];
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/** Parse an env var as a boolean ("true"/"1"/"yes" → true), fallback to `defaultValue`. */
function envBool(key, defaultValue) {
  const raw = process.env[key];
  if (raw === undefined || raw === null) return defaultValue;
  return ["true", "1", "yes"].includes(raw.trim().toLowerCase());
}

// ─────────────────────────────────────────────────────────────
// CONFIG OBJECT
// ─────────────────────────────────────────────────────────────

const config = Object.freeze({
  // Test directory to scan
  testDir: './tests',
  
  // High timeout required for AI inference
  timeout: envInt("STEP_TIMEOUT_MS", 60000),

  // ── AI / Heal Engine ───────────────────────────────────────
  
  healer: {
    model: 'gemini-2.5-flash',
    confidenceThreshold: envFloat("CONFIDENCE_THRESHOLD", 0.80),
  },

  /** Gemini API key — MUST be set in .env as GEMINI_API_KEY */
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",

  /**
   * Maximum number of heal attempts before the runner gives up
   * and marks the test as permanently failed.
   * .env key: MAX_RETRIES
   */
  maxRetries: envInt("MAX_RETRIES", 3),

  /**
   * Safe mode: when true the runner only logs suggested fixes
   * but does NOT rewrite or re-execute the healed code.
   * .env key: SAFE_MODE
   */
  safeMode: envBool("SAFE_MODE", false),

  // ── Dashboard / WebSocket ──────────────────────────────────
  
  dashboard: {
    port: envInt("DASHBOARD_PORT", 3000),
    openOnStart: true
  },

  /**
   * WebSocket port for live progress events pushed to the dashboard.
   * .env key: WS_PORT
   */
  wsPort: envInt("WS_PORT", 3001),

  // ── Database ───────────────────────────────────────────────

  /**
   * Path (relative to project root) for the SQLite heal history DB.
   * .env key: DB_PATH
   */
  dbPath: process.env.DB_PATH ?? "./data/heals.db"
});

export default config;
