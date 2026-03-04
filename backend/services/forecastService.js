/**
 * AERIS Backend — Forecast Service
 * ────────────────────────────────────────────────────────────────
 * Generates basic statistical trend predictions for PM2.5 and calculated RRI.
 * Simulates an ML prediction engine by analyzing immediate historical
 * deltas (rate of change) and projecting them forward with decaying confidence.
 */

const db = require('../utils/db');

/**
 * Generate a new 6-hour forecast based on the latest reading and 
 * the historical trend of the last few hours.
 * 
 * @param {Object} latestReading - The new incoming telemetry reading
 */
const generateAndStoreForecast = async (latestReading) => {
  try {
    // 1. Fetch recent history to determine trend trajectory
    const readingsRef = db.collection('environmentReadings');
    const snapshot = await readingsRef.orderBy('timestamp', 'desc').limit(4).get();

    const recentReadings = [];
    snapshot.forEach(doc => recentReadings.push(doc.data()));

    let pm25Delta = 0;
    let rriDelta = 0;

    // Calculate average rate of change if we have enough history
    if (recentReadings.length > 1) {
      let totalPm25Delta = 0;
      let totalRriDelta = 0;

      for (let i = 0; i < recentReadings.length - 1; i++) {
        totalPm25Delta += (recentReadings[i].pm25 - recentReadings[i + 1].pm25);
        totalRriDelta += ((recentReadings[i].rri || 0) - (recentReadings[i + 1].rri || 0));
      }

      pm25Delta = totalPm25Delta / (recentReadings.length - 1);
      rriDelta = totalRriDelta / (recentReadings.length - 1);
    }

    // Dampen the delta so predictions don't explode infinitely
    const dampeningFactor = 0.6;
    let basePm25 = latestReading.pm25;
    let baseRri = latestReading.rri || 30;

    const baseTime = latestReading.timestamp ? new Date(latestReading.timestamp) : new Date();

    // 2. We will replace the entire existing forecast to keep the table clean and fresh
    const forecastRef = db.collection('forecasts');
    const existingForecasts = await forecastRef.get();

    if (!existingForecasts.empty) {
      const batch = db.batch();
      existingForecasts.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    const forecastEntries = [];

    // 3. Project 6 hours forward
    for (let i = 1; i <= 6; i++) {
      const targetTime = new Date(baseTime.getTime() + (i * 60 * 60 * 1000));

      // Apply dampened delta per hour
      basePm25 += (pm25Delta * dampeningFactor);
      baseRri += (rriDelta * dampeningFactor);

      // Enforce physical bounds
      basePm25 = Math.max(0, Math.min(500, basePm25));
      baseRri = Math.max(0, Math.min(100, baseRri));

      // Confidence degrades by 8% each hour into the future
      const confidence = Math.max(30, 95 - (i * 8));

      forecastEntries.push({
        targetTime,
        pm25: parseFloat(basePm25.toFixed(1)),
        aqi: null, // We leave this null for now unless requested
        rri: parseInt(baseRri),
        confidence: parseInt(confidence)
      });
    }

    // 4. Batch insert new forecast
    const addBatch = db.batch();
    forecastEntries.forEach(entry => {
      const newRef = forecastRef.doc();
      addBatch.set(newRef, {
        ...entry,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    await addBatch.commit();

    // Optionally return them if the caller wants them immediately
    return forecastEntries;

  } catch (error) {
    console.error('[Forecast Service] Generation failed:', error);
  }
};

module.exports = { generateAndStoreForecast };
