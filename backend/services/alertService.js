/**
 * AERIS Backend — Alert Detection Service
 * ────────────────────────────────────────────────────────────────
 * Evaluates incoming telemetry against critical environmental thresholds.
 * If thresholds are breached, it generates severity-mapped alerts,
 * stores them in the database, and returns them to the caller.
 */

const db = require('../utils/db');

/**
 * Checks a new reading against configured thresholds and historical context.
 * 
 * Rules:
 * - PM2.5 > 100 (SEVERE_POLLUTION, critical)
 * - CO > 35 (SEVERE_POLLUTION, critical)
 * - VOC > 250 (SEVERE_POLLUTION, warning)
 * - Rapid Ozone increase (EVENT_DETECTED, warning) -> e.g., > 20 ppb jump in one reading
 * 
 * @param {string} nodeId - The ID of the node generating the reading
 * @param {Object} currentReading - The normalized reading payload
 * @returns {Array} List of saved alert objects
 */
const detectAndStoreAlerts = async (nodeId, currentReading) => {
  const alertsToCreate = [];

  // ── 1. Static Thresholds ────────────────────────────────────────

  if (currentReading.pm25 > 100) {
    alertsToCreate.push({
      nodeId,
      type: 'SEVERE_POLLUTION',
      severity: 'critical',
      message: `Critical PM2.5 levels detected (${currentReading.pm25} µg/m³). Avoid outdoor exposure.`,
      resolved: false,
      timestamp: new Date()
    });
  }

  if (currentReading.co > 35) {
    alertsToCreate.push({
      nodeId,
      type: 'SEVERE_POLLUTION',
      severity: 'critical',
      message: `Hazardous Carbon Monoxide levels detected (${currentReading.co} ppm). Evacuate immediate area if indoors.`,
      resolved: false,
      timestamp: new Date()
    });
  }

  if (currentReading.vocIndex > 250) {
    alertsToCreate.push({
      nodeId,
      type: 'SEVERE_POLLUTION',
      severity: 'warning',
      message: `High Volatile Organic Compounds detected (Index: ${currentReading.vocIndex}). Ensure adequate ventilation.`,
      resolved: false,
      timestamp: new Date()
    });
  }

  // ── 2. Dynamic Thresholds (Rapid Increase) ──────────────────────

  // Fetch the very last reading for this node to compare ozone
  const readingsRef = db.collection('environmentReadings');
  const lastSnapshot = await readingsRef
    .where('nodeId', '==', nodeId)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  if (!lastSnapshot.empty) {
    const lastReading = lastSnapshot.docs[0].data();
    const ozoneDelta = currentReading.o3 - (lastReading.o3 || 0);
    // Arbitrary threshold for "rapid increase": jump of > 20 ppb instantly
    if (ozoneDelta > 20) {
      alertsToCreate.push({
        nodeId,
        type: 'EVENT_DETECTED',
        severity: 'warning',
        message: `Rapid surface ozone increase detected (+${ozoneDelta.toFixed(1)} ppb). May trigger respiratory sensitivity.`,
        resolved: false,
        timestamp: new Date()
      });
    }
  }

  // ── 3. Persist Alerts ───────────────────────────────────────────

  const savedAlerts = [];
  const alertsRef = db.collection('alerts');

  for (const alertData of alertsToCreate) {
    const saved = await alertsRef.add({
      ...alertData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    savedAlerts.push({ ...alertData, id: saved.id });
  }

  return savedAlerts;
};

module.exports = {
  detectAndStoreAlerts
};
