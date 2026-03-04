const db = require('../utils/db');
const { getAQICategory, calculateRiskMetrics } = require('../utils/riskEngine');

const getLatest = async (req, res) => {
  try {
    const readingsRef = db.collection('environmentReadings');
    const latestSnapshot = await readingsRef.orderBy('timestamp', 'desc').limit(1).get();

    if (latestSnapshot.empty) {
      return res.status(404).json({ success: false, message: 'No telemetry data available' });
    }

    const latestDoc = latestSnapshot.docs[0];
    const latest = latestDoc.data();

    // Fetch node info
    let nodeName = "Unknown Node";
    if (latest.nodeId) {
      const nodeDoc = await db.collection('nodes').doc(latest.nodeId).get();
      if (nodeDoc.exists) {
        nodeName = nodeDoc.data().name;
      }
    }

    // Previous reading for trend calculation
    const previousSnapshot = await readingsRef
      .where('nodeId', '==', latest.nodeId)
      .where('timestamp', '<', latest.timestamp)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    let previous = null;
    if (!previousSnapshot.empty) {
      previous = previousSnapshot.docs[0].data();
    }

    let trend = 'stable';
    if (previous && latest.rri && previous.rri) {
      if (latest.rri > previous.rri + 2) trend = 'up'; // Worse
      else if (latest.rri < previous.rri - 2) trend = 'down'; // Better
    }

    // Determine dominant pollutant loosely by weight mapping
    const pollutants = [
      { name: 'PM2.5', weight: latest.pm25 / 35 },
      { name: 'CO', weight: (latest.co || 0) / 9 },
      { name: 'Ozone', weight: (latest.o3 || 0) / 70 },
      { name: 'VOC', weight: (latest.vocIndex || 0) / 500 }
    ];
    pollutants.sort((a, b) => b.weight - a.weight);
    const dominant = pollutants[0].name;

    const riskMetrics = calculateRiskMetrics({
      pm25: latest.pm25,
      co: latest.co || 0,
      o3: latest.o3 || 0,
      vocIndex: latest.vocIndex || 0
    });

    // Structure mapped exactly to Zustand store requirements
    return res.json({
      success: true,
      data: {
        meta: {
          location: nodeName,
          timestamp: latest.timestamp ? latest.timestamp.toDate() : new Date(),
          source: 'Live Sensors'
        },
        sensors: {
          pm25: latest.pm25,
          co: latest.co || 0,
          o3: latest.o3 || 0,
          voc_index: latest.vocIndex || 0
        },
        environment: {
          temperature: latest.temperature || 0,
          humidity: latest.humidity || 0,
          oxygen: latest.oxygen || 20.9,
          pressure: latest.pressure || 1013
        },
        derived: {
          aqi: latest.aqi || riskMetrics.aqi,
          aqi_category: getAQICategory(latest.aqi || riskMetrics.aqi),
          rri: latest.rri || riskMetrics.rri,
          risk_level: riskMetrics.riskLevel,
          dominant: dominant
        },
        trend: trend
      }
    });
  } catch (e) {
    console.error("Environment Fetch Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const readingsRef = db.collection('environmentReadings');
    const snapshot = await readingsRef.orderBy('timestamp', 'desc').limit(24).get();

    const history = [];
    snapshot.forEach(doc => {
      history.push(doc.data());
    });

    // Reverse to chronological order for charts
    history.reverse();

    const formatted = history.map(h => {
      const date = h.timestamp ? h.timestamp.toDate() : new Date();
      return {
        time: date.toISOString().substring(11, 16), // 'HH:mm' format expected by Recharts
        pm25: h.pm25,
        rri: h.rri || 0
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (e) {
    console.error("History Fetch Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
};

module.exports = { getLatest, getHistory };
