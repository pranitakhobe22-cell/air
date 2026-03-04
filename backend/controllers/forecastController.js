const db = require('../utils/db');

const getForecast = async (req, res) => {
  try {
    const forecastRef = db.collection('forecasts');
    const snapshot = await forecastRef.orderBy('targetTime', 'asc').limit(6).get();

    if (snapshot.empty) {
      // Mock forecast failover if the engine hasn't triggered yet
      const mockForecast = [];
      let baseTime = new Date();
      for (let i = 1; i <= 6; i++) {
        const nextHour = new Date(baseTime.getTime() + i * 60 * 60 * 1000);
        mockForecast.push({
          time: nextHour.toISOString().substring(11, 16),
          pm25: Math.floor(Math.random() * 50) + 10,
          rri: Math.floor(Math.random() * 40) + 20,
          confidence: Math.max(30, 95 - (i * 5))
        });
      }
      return res.json({ success: true, data: mockForecast });
    }

    const forecast = [];
    snapshot.forEach(doc => forecast.push(doc.data()));

    const formatted = forecast.map(f => {
      const date = f.targetTime ? f.targetTime.toDate() : new Date();
      return {
        time: date.toISOString().substring(11, 16),
        pm25: f.pm25,
        rri: f.rri,
        confidence: f.confidence
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (e) {
    console.error("Forecast Fetch Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
};

module.exports = { getForecast };
