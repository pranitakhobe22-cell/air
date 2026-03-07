/**
 * AERIS — Azure Cosmos DB Client
 * ────────────────────────────────────────────────────────────────
 * All containers live in the existing 'sensorData' database.
 * No throughput is set on containers — they inherit whatever the
 * database was created with (works on Azure free tier).
 *
 *   sensorData (existing)
 *     ├── livelogs   partition: /sensorId
 *     ├── users      partition: /email
 *     └── profiles   partition: /userId
 */

// Ensure backend/.env is loaded regardless of cwd
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { CosmosClient } = require('@azure/cosmos');

const DATABASE_ID = 'sensorData';

let _client = null;
const _containers = {};

const _getClient = () => {
    if (!_client) {
        if (!process.env.COSMOS_CONNECTION_STRING) {
            throw new Error('COSMOS_CONNECTION_STRING is not configured in .env');
        }
        _client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
    }
    return _client;
};

/**
 * Returns a reference to a container — reads it if it exists, skips
 * creation entirely to avoid throughput conflicts on free-tier accounts.
 * If a container is missing, Azure will throw a 404 on the first operation.
 */
const getContainer = async (containerName = 'livelogs') => {
    if (!_containers[containerName]) {
        const client = _getClient();
        // Just get a reference — do NOT call createIfNotExists (avoids RU/s limits)
        _containers[containerName] = client
            .database(DATABASE_ID)
            .container(containerName);
    }
    return _containers[containerName];
};

/**
 * Warmup: verify connection + create missing containers.
 * Uses createIfNotExists with NO throughput spec so Azure assigns the
 * container to the database's existing shared allocation.
 */
const initCosmos = async () => {
    const client = _getClient();
    // Recreate DB with SHARED throughput natively if it ever gets deleted
    const { database: db } = await client.databases.createIfNotExists({ id: DATABASE_ID, throughput: 400 });

    const containerSpecs = [
        { id: 'livelogs', partitionKey: { paths: ['/sensorId'] } },
        { id: 'users', partitionKey: { paths: ['/email'] } },
        { id: 'profiles', partitionKey: { paths: ['/userId'] } },
    ];

    for (const spec of containerSpecs) {
        try {
            const { container } = await db.containers.createIfNotExists(spec);
            _containers[spec.id] = container;
            console.log(`✅ [Cosmos] Container ready: ${spec.id}`);
        } catch (err) {
            // If this is a throughput error the container likely already exists —
            // fall back to a direct reference and continue.
            if (err.code === 400 || err.code === 403 || (err.message && err.message.includes('throughput'))) {
                console.warn(`⚠️  [Cosmos] createIfNotExists failed for '${spec.id}' (throughput limit) — using direct reference.`);
                _containers[spec.id] = client.database(DATABASE_ID).container(spec.id);
            } else {
                throw err;  // real error — rethrow
            }
        }
    }

    console.log('✅ [Cosmos] All containers initialized.');
};

/** True if Cosmos DB credentials are present in the environment. */
const isConfigured = () => !!process.env.COSMOS_CONNECTION_STRING;

module.exports = { getContainer, initCosmos, isConfigured };
