/**
 * IP Geolocation with in-memory cache.
 * Uses ip-api.com (free, no key required, 45 req/min).
 * Caches results for 1 hour per IP to avoid rate limits.
 */

const cache = new Map(); // ip -> { lat, lng, city, region, country, ts }
const CACHE_TTL = 3600000; // 1 hour

const geolocateIp = async (ip) => {
    if (!ip || ip === '::1' || ip === '127.0.0.1') return null;

    // Strip IPv6 prefix
    const cleanIp = ip.replace(/^::ffff:/, '');
    if (cleanIp.startsWith('10.') || cleanIp.startsWith('192.168.') || cleanIp.startsWith('172.')) {
        return null; // private IP, can't geolocate
    }

    // Check cache
    const cached = cache.get(cleanIp);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached;
    }

    try {
        const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,lat,lon,city,regionName,country`);
        const data = await res.json();

        if (data.status === 'success') {
            const entry = {
                lat: data.lat,
                lng: data.lon,
                city: data.city,
                region: data.regionName,
                country: data.country,
                ts: Date.now(),
            };
            cache.set(cleanIp, entry);
            console.log(`[GEO] ${cleanIp} -> ${data.city}, ${data.regionName} (${data.lat}, ${data.lon})`);
            return entry;
        }
    } catch (err) {
        console.error('[GEO] Lookup failed:', err.message);
    }

    return null;
};

// Shared store for ESP32 locations, keyed by nodeId
const espLocations = new Map(); // nodeId -> { lat, lng, city, region, country, ts }

const setEspLocation = (loc) => {
    if (loc?.nodeId) espLocations.set(loc.nodeId, loc);
};

const getEspLocation = (nodeId) => {
    if (nodeId) return espLocations.get(nodeId) || null;
    // If no nodeId specified, return first available (backward compat)
    const first = espLocations.values().next();
    return first.done ? null : first.value;
};

const getAllEspLocations = () => Object.fromEntries(espLocations);

module.exports = { geolocateIp, setEspLocation, getEspLocation, getAllEspLocations };

