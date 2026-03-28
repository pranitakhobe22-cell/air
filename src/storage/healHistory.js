import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'heals.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS heals (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        original_selector TEXT NOT NULL,
        healed_selector   TEXT NOT NULL,
        intent            TEXT,
        test_file         TEXT,
        root_cause        TEXT,
        confidence        REAL,
        method            TEXT DEFAULT 'gemini-ai',
        timestamp         TEXT DEFAULT (datetime('now')),
        script_name       TEXT
      )
    `);
  }
  return db;
}

export function findCachedHeal(originalSelector, intent = null) {
  // If intent matches, we highly trust the cache. 
  // Otherwise just match original selector with high conf.
  const query = intent ? 
    'SELECT * FROM heals WHERE original_selector = ? AND intent = ? ORDER BY id DESC LIMIT 1' :
    'SELECT * FROM heals WHERE original_selector = ? AND confidence >= 0.8 ORDER BY id DESC LIMIT 1';
  
  const stmt = getDb().prepare(query);
  const row = intent ? stmt.get(originalSelector, intent) : stmt.get(originalSelector);
  return row || null;
}

export function saveHeal(entry) {
  const stmt = getDb().prepare(`
    INSERT INTO heals (original_selector, healed_selector, intent, test_file, root_cause, confidence, method, script_name)
    VALUES (@original_selector, @healed_selector, @intent, @test_file, @root_cause, @confidence, @method, @script_name)
  `);
  return stmt.run({
...entry,
    intent:            entry.intent || null,
    test_file:         entry.test_file || null,
    root_cause:        entry.root_cause || null,
    confidence:        entry.confidence || 0,
    method:            entry.method || 'gemini-ai',
    script_name:       entry.script_name || null,
  });
}

export function getAllHeals() {
  return getDb().prepare('SELECT * FROM heals ORDER BY id DESC').all();
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
