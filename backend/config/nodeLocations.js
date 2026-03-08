/**
 * AERIS — Static Per-Node GPS Location Config
 * ────────────────────────────────────────────────────────────────
 * IP-based geolocation is city-level only (±5–50 km error).
 * Set NODE_LOCATIONS in your .env for accurate device coordinates.
 *
 * Format (env var):
 *   NODE_LOCATIONS=NODE_ID:lat:lng:Display Name|NODE_ID2:lat2:lng2:Name2
 *
 * Example:
 *   NODE_LOCATIONS=ESP32_01:18.5204:73.8567:MITAOE Rooftop|ESP32_02:18.5298:73.8451:College Gate
 *
 * How to get accurate coordinates:
 *   1. Open Google Maps at the physical device location
 *   2. Right-click the exact spot → "What's here?"
 *   3. Copy the latitude and longitude shown at the bottom
 */

const parseNodeLocations = () => {
    const raw = process.env.NODE_LOCATIONS || '';
    const map = {};
    if (!raw.trim()) return map;

    for (const entry of raw.split('|')) {
        const parts = entry.split(':');
        if (parts.length < 3) continue;
        const id   = parts[0].trim();
        const lat  = parseFloat(parts[1]);
        const lng  = parseFloat(parts[2]);
        const name = parts.slice(3).join(':').trim() || id;

        if (id && !isNaN(lat) && !isNaN(lng)) {
            map[id] = { lat, lng, name };
        }
    }

    return map;
};

const NODE_LOCATIONS = parseNodeLocations();

if (Object.keys(NODE_LOCATIONS).length > 0) {
    console.log('[NodeLocations] Static locations loaded:', Object.keys(NODE_LOCATIONS).join(', '));
} else {
    console.warn('[NodeLocations] No NODE_LOCATIONS set — will use IP geolocation (city-level accuracy). See backend/config/nodeLocations.js for setup instructions.');
}

module.exports = { NODE_LOCATIONS };
