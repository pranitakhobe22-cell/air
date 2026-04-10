'use strict';

/**
 * Haversine distance in kilometres between two [lat, lng] pairs
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Inverse Distance Weighting — estimate AQI at a point from nearby anchors
 */
function idw(targetLat, targetLng, anchors, power = 2, maxDistance = 200) {
  let num = 0, den = 0;
  for (const a of anchors) {
    const d = haversineKm(targetLat, targetLng, a.lat, a.lng);
    if (d < 0.01) return { aqi: Math.round(a.aqi) };
    if (d > maxDistance) continue;
    const w = 1 / Math.pow(d, power);
    num += w * a.aqi;
    den += w;
  }
  return { aqi: den === 0 ? 50 : Math.round(num / den) };
}

module.exports = { haversineKm, idw };

