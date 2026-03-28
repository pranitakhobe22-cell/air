/**
 * src/patcher/patchWriter.js
 * ============================================================
 * Permanently rewrites a Playwright test file so that every
 * occurrence of `oldSelector` is replaced with `newSelector`.
 *
 * Safety guarantees
 * ─────────────────
 *  1. A .bak file is written BEFORE the source is touched.
 *     If the backup already exists it is timestamped to avoid
 *     overwriting an earlier backup from a previous patch run.
 *  2. The patched content is written to a temp file first, then
 *     atomically renamed over the original (rename is atomic on
 *     the same filesystem — avoids partial-write corruption).
 *  3. If the selector is not found the file is left untouched
 *     and the function returns a result with match count 0.
 *  4. Both single-quote, double-quote, and backtick forms of
 *     the selector string are replaced (Playwright allows all three).
 *
 * @module patchWriter
 * ============================================================
 */

import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";

// ─────────────────────────────────────────────────────────────
// TYPES (JSDoc only — no runtime cost)
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PatchOptions
 * @property {boolean} [dryRun=false]
 *   When true: compute the patch and return the result WITHOUT
 *   touching the filesystem. Useful for safeMode previews.
 * @property {boolean} [allOccurrences=true]
 *   When true (default): replace ALL occurrences of oldSelector.
 *   When false: replace only the FIRST occurrence.
 */

/**
 * @typedef {Object} PatchResult
 * @property {boolean} patched        - true if at least one replacement was made.
 * @property {number}  matchCount     - How many occurrences were found.
 * @property {number}  replacedCount  - How many occurrences were replaced.
 * @property {string}  backupPath     - Absolute path of the .bak file (empty on dryRun).
 * @property {string}  filePath       - Absolute path of the patched file.
 * @property {string}  oldSelector    - The selector that was searched for.
 * @property {string}  newSelector    - The selector it was replaced with.
 * @property {boolean} dryRun         - Whether this was a dry run.
 * @property {string}  patchedSource  - The full patched source (always populated).
 */

// ─────────────────────────────────────────────────────────────
// SECTION 1 — CORE REPLACEMENT LOGIC
// ─────────────────────────────────────────────────────────────

/**
 * Build a RegExp that matches `selector` wrapped in any JS quote style
 * (' " `), handling escaped quotes inside the string safely.
 *
 * Why a regex rather than a plain string replace?
 * ─────────────────────────────────────────────────
 * The selector '#login-btn' might appear in the source as:
 *   page.click('#login-btn')
 *   page.locator("#login-btn")
 *   page.fill(`#login-btn`, value)
 * We want to match ALL three forms to avoid missing occurrences.
 *
 * @param {string} selector   - Raw selector string (e.g. "#login-btn").
 * @returns {RegExp}
 */
function buildSelectorRegex(selector) {
  // Escape all regex meta-characters inside the selector literal.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Match the selector surrounded by any consistent quote char (' " `).
  // Capture group 1 = the opening quote char so we can restore it.
  return new RegExp(`(['"\`])(${escaped})\\1`, "g");
}

/**
 * Replace occurrences of `oldSelector` with `newSelector` in `source`.
 * Preserves the original surrounding quote character.
 *
 * @param {string}  source         - Full file contents.
 * @param {string}  oldSelector    - Selector to find.
 * @param {string}  newSelector    - Selector to insert.
 * @param {boolean} allOccurrences - Replace all or just the first.
 * @returns {{ result: string, matchCount: number, replacedCount: number }}
 */
function applyReplacement(source, oldSelector, newSelector, allOccurrences) {
  const regex = buildSelectorRegex(oldSelector);
  let matchCount = 0;
  let replacedCount = 0;

  // Count total matches first so we can report accurately.
  const allMatches = source.match(regex);
  matchCount = allMatches ? allMatches.length : 0;

  if (matchCount === 0) {
    return { result: source, matchCount: 0, replacedCount: 0 };
  }

  const limit = allOccurrences ? Infinity : 1;

  const result = source.replace(regex, (match, quote, _captured) => {
    if (replacedCount >= limit) return match; // leave remainder untouched
    replacedCount++;
    return `${quote}${newSelector}${quote}`;
  });

  return { result, matchCount, replacedCount };
}

// ─────────────────────────────────────────────────────────────
// SECTION 2 — BACKUP HELPER
// ─────────────────────────────────────────────────────────────

/**
 * Write a backup of `filePath` to `filePath.bak`.
 * If `filePath.bak` already exists (from a previous heal), the backup
 * is written as `filePath.bak.<timestamp>` to preserve history.
 *
 * @param {string} filePath    - Path of the original file.
 * @param {string} contents    - Current file contents to back up.
 * @returns {Promise<string>}  - Absolute path of the backup file.
 */
async function writeBackup(filePath, contents) {
  const primaryBak = `${filePath}.bak`;

  let targetBak = primaryBak;

  if (existsSync(primaryBak)) {
    // Don't overwrite an existing .bak — stamp it with current time.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    targetBak = `${filePath}.bak.${stamp}`;
  }

  await fs.writeFile(targetBak, contents, "utf8");
  return path.resolve(targetBak);
}

// ─────────────────────────────────────────────────────────────
// SECTION 3 — ATOMIC WRITE
// ─────────────────────────────────────────────────────────────

/**
 * Write `contents` to `filePath` atomically:
 *   1. Write to a sibling `.tmp` file.
 *   2. Rename it over the original.
 *
 * This ensures the file is never left in a partially-written state
 * if the process is killed mid-write.
 *
 * @param {string} filePath  - Destination file path.
 * @param {string} contents  - Content to write.
 * @returns {Promise<void>}
 */
async function atomicWrite(filePath, contents) {
  const tmpPath = `${filePath}.selfheal-tmp`;
  try {
    await fs.writeFile(tmpPath, contents, "utf8");
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Clean up orphaned tmp file on failure, best-effort.
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 4 — PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Patch a Playwright test file by replacing `oldSelector` with `newSelector`.
 *
 * @param {string}       filePath      - Absolute (or relative-to-cwd) path to the .spec.js file.
 * @param {string}       oldSelector   - The selector string to find (without surrounding quotes).
 * @param {string}       newSelector   - The replacement selector string (without surrounding quotes).
 * @param {PatchOptions} [options={}]  - Optional behaviour overrides.
 * @returns {Promise<PatchResult>}
 *
 * @example
 * // Standard patch (rewrites file, creates backup):
 * const result = await patchSelector(
 *   '/abs/path/login.spec.js',
 *   '#login-btn',
 *   "[data-testid='login']"
 * );
 * if (result.patched) {
 *   console.log(`Replaced ${result.replacedCount} occurrence(s). Backup: ${result.backupPath}`);
 * }
 *
 * @example
 * // Dry-run preview (nothing written to disk):
 * const preview = await patchSelector(file, old, newSel, { dryRun: true });
 * console.log(preview.patchedSource);
 */
export async function patchSelector(filePath, oldSelector, newSelector, options = {}) {
  const { dryRun = false, allOccurrences = true } = options;

  const absPath = path.resolve(filePath);

  // ── Guard: file must exist and be readable ─────────────────
  let originalSource;
  try {
    originalSource = await fs.readFile(absPath, "utf8");
  } catch (err) {
    throw new Error(`[patchWriter] Cannot read file: ${absPath}\n${err.message}`);
  }

  // ── Guard: selectors must be non-empty and different ───────
  if (!oldSelector || typeof oldSelector !== "string") {
    throw new TypeError("[patchWriter] oldSelector must be a non-empty string.");
  }
  if (!newSelector || typeof newSelector !== "string") {
    throw new TypeError("[patchWriter] newSelector must be a non-empty string.");
  }
  if (oldSelector === newSelector) {
    return {
      patched: false,
      matchCount: 0,
      replacedCount: 0,
      backupPath: "",
      filePath: absPath,
      oldSelector,
      newSelector,
      dryRun,
      patchedSource: originalSource,
    };
  }

  // ── Apply replacement ──────────────────────────────────────
  const { result: patchedSource, matchCount, replacedCount } = applyReplacement(
    originalSource,
    oldSelector,
    newSelector,
    allOccurrences
  );

  const patched = replacedCount > 0;

  // ── Dry run: return without touching the filesystem ────────
  if (dryRun || !patched) {
    return {
      patched,
      matchCount,
      replacedCount,
      backupPath: "",
      filePath: absPath,
      oldSelector,
      newSelector,
      dryRun,
      patchedSource,
    };
  }

  // ── Write backup then atomically overwrite the original ────
  const backupPath = await writeBackup(absPath, originalSource);
  await atomicWrite(absPath, patchedSource);

  return {
    patched: true,
    matchCount,
    replacedCount,
    backupPath,
    filePath: absPath,
    oldSelector,
    newSelector,
    dryRun: false,
    patchedSource,
  };
}

// ─────────────────────────────────────────────────────────────
// SECTION 5 — RESTORE FROM BACKUP
// ─────────────────────────────────────────────────────────────

/**
 * Restore a previously patched file from its `.bak` backup.
 * Useful when safeMode is toggled on after the fact, or the healed
 * selector turned out to be wrong.
 *
 * @param {string} filePath - Absolute path of the patched file.
 * @returns {Promise<{ restored: boolean, backupPath: string, filePath: string }>}
 */
export async function restoreFromBackup(filePath) {
  const absPath = path.resolve(filePath);
  const bakPath = `${absPath}.bak`;

  if (!existsSync(bakPath)) {
    return { restored: false, backupPath: bakPath, filePath: absPath };
  }

  const backupContents = await fs.readFile(bakPath, "utf8");
  await atomicWrite(absPath, backupContents);

  return { restored: true, backupPath: bakPath, filePath: absPath };
}

// ─────────────────────────────────────────────────────────────
// SECTION 6 — CONVENIENCE DEFAULT EXPORT
// ─────────────────────────────────────────────────────────────

export default patchSelector;
