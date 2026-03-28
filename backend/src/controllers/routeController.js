'use strict';

const { analyzeRoute, geocode } = require('../services/routeService');

exports.analyze = async (req, res) => {
  try {
    let { origin, destination, startLat, startLng, endLat, endLng } = req.body;

    if (!startLat && origin) {
      const [sGeo, eGeo] = await Promise.all([geocode(origin), geocode(destination)]);
      if (sGeo) { startLat = sGeo.lat; startLng = sGeo.lng; }
      if (eGeo) { endLat = eGeo.lat; endLng = eGeo.lng; }
    }

    const data = await analyzeRoute({ origin, destination, startLat, startLng, endLat, endLng });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[ROUTE API]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.geocodePlace = async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ success: false, message: 'Missing query: q' });
    const result = await geocode(q);
    if (!result) return res.status(404).json({ success: false, message: `Could not geocode: ${q}` });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
