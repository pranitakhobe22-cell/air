const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/aeris.db';
const dbDir = path.dirname(dbPath);

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize the database
const db = new Database(dbPath, { verbose: console.log });
db.pragma('journal_mode = WAL');

// ── Schema Initialization ───────────────────────────────────────
const initializeSchema = () => {
    console.log('🏗️  [Database] Initializing schema...');

    db.exec(`
        CREATE TABLE IF NOT EXISTS locations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT CHECK(type IN ('industrial', 'residential', 'transit', 'school', 'commercial')) NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sensor_nodes (
            id TEXT PRIMARY KEY,
            location_id TEXT,
            status TEXT CHECK(status IN ('online', 'offline')) DEFAULT 'offline',
            last_sync TEXT,
            FOREIGN KEY (location_id) REFERENCES locations(id)
        );

        CREATE TABLE IF NOT EXISTS sensor_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT NOT NULL,
            pm25 REAL,
            pm10 REAL,
            co REAL,
            nox REAL,
            o3 REAL,
            voc_index REAL,
            temperature REAL,
            humidity REAL,
            oxygen REAL,
            pressure REAL,
            aqi INTEGER,
            aqi_category TEXT,
            air_quality_text TEXT,
            rri INTEGER,
            risk_level TEXT,
            risk_color TEXT,
            dominant TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (node_id) REFERENCES sensor_nodes(id)
        );

        CREATE TABLE IF NOT EXISTS user_profiles (
            id TEXT PRIMARY KEY,
            age_group TEXT,
            gender TEXT,
            asthma BOOLEAN DEFAULT 0,
            smoking_level TEXT,
            conditions TEXT,
            multiplier REAL DEFAULT 1.0
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log('✅ [Database] Schema initialized successfully.');
};

initializeSchema();

console.log(`📡 [Database] Connected at ${dbPath}`);

module.exports = db;
