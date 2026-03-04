/**
 * AERIS Backend — Network Monitoring Service
 * ────────────────────────────────────────────────────────────────
 * Tracks the health, heartbeat, and online status of all physical
 * ESP32 sensor nodes. If a node fails to ping within the threshold,
 * it is automatically flagged as offline.
 */

const db = require('../utils/db');

// Nodes not reporting for 5 minutes (300,000 ms) are considered offline
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Sweeps the database to identify nodes that have missed their heartbeat
 * and flags them as offline.
 */
const sweepOfflineNodes = async () => {
  try {
    const cutoffTime = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    const nodesRef = db.collection('nodes');
    const snapshot = await nodesRef
      .where('status', '==', 'active')
      .where('lastPing', '<', cutoffTime)
      .get();

    if (!snapshot.empty) {
      let count = 0;
      const batch = db.batch();

      snapshot.forEach(doc => {
        batch.update(doc.ref, { status: 'offline' });
        count++;
      });

      await batch.commit();
      console.log(`[Network Monitor] Swept and marked ${count} node(s) as offline due to heartbeat timeout.`);
    }
  } catch (err) {
    console.error('[Network Monitor] Heartbeat sweep failed:', err.message);
  }
};

/**
 * Initializes the background interval worker to continuously check node health.
 */
const initNetworkMonitor = () => {
  // Run sweep every 60 seconds
  setInterval(sweepOfflineNodes, 60 * 1000);
  console.log('🌐 Network Monitoring Service Initialized (60s tick)');
};

module.exports = {
  sweepOfflineNodes,
  initNetworkMonitor
};
