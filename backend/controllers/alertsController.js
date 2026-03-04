const db = require('../utils/db');

const getAlerts = async (req, res) => {
  try {
    const alertsRef = db.collection('alerts');
    const snapshot = await alertsRef
      .where('resolved', '==', false)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const formatted = [];
    snapshot.forEach(doc => {
      const a = doc.data();
      formatted.push({
        id: doc.id,
        timestamp: a.timestamp ? a.timestamp.toDate() : new Date(),
        type: a.type,
        severity: a.severity,
        message: a.message
      });
    });

    return res.json({ success: true, data: formatted });
  } catch (e) {
    console.error("Alerts Fetch Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
};

module.exports = { getAlerts };
