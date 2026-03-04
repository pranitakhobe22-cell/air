const Location = require('../models/Location');
const SensorNode = require('../models/SensorNode');
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Profile = require('../models/Profile');

/**
 * AERIS – Core API Controller
 * ────────────────────────────────────────────────────────────────
 * Aggregates data from multiple models to satisfy the AERIS_DATA
 * structure required by the frontend.
 */

const getLatestData = (req, res) => {
    try {
        const latestReadings = Reading.findAll();
        const primaryReading = latestReadings.length > 0 ? latestReadings.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0] : null;
        
        const nodes = SensorNode.findAll();
        const locations = Location.findAll();
        const alerts = Alert.findRecent(10);
        const profile = Profile.findAll()[0] || { name: 'User', sensitivity: 'moderate' };

        // Aggregate History (last 24)
        const history = latestReadings.map(r => ({
            timestamp: r.created_at,
            pm25: r.pm25,
            co: r.co,
            o3: r.o3,
            aqi: r.aqi,
            rri: r.rri,
            temperature: r.temperature,
            humidity: r.humidity
        })).slice(-24);

        // Aggregate Sectors
        const sectors = locations.map(loc => {
            const node = nodes.find(n => n.location_id === loc.id);
            const reading = node ? latestReadings.find(r => r.node_id === node.id) : null;
            return {
                id: loc.id,
                name: loc.name,
                aqi: reading ? reading.aqi : 0,
                rri: reading ? reading.rri : 0,
                status: reading ? reading.risk_level : 'Safe',
                lat: loc.lat,
                lng: loc.lng
            };
        });

        const fullData = {
            meta: {
                location: primaryReading?.node_id === 'node-01' ? 'Sector Alpha' : 'Live Sector',
                timestamp: primaryReading?.created_at || new Date().toISOString(),
                source: 'live-api'
            },
            sensors: {
                pm25: primaryReading?.pm25 || 0,
                pm10: primaryReading?.pm10 || 0,
                co: primaryReading?.co || 0,
                nox: primaryReading?.nox || 0,
                o3: primaryReading?.o3 || 0,
                voc_index: primaryReading?.voc_index || 0
            },
            environment: {
                temperature: primaryReading?.temperature || 25,
                humidity: primaryReading?.humidity || 50,
                oxygen: primaryReading?.oxygen || 20.9,
                pressure: primaryReading?.pressure || 1013
            },
            derived: {
                aqi: primaryReading?.aqi || 0,
                aqi_category: primaryReading?.aqi_category || 'Scanning',
                air_quality_text: primaryReading?.air_quality_text || 'Mesh network initializing...',
                rri: primaryReading?.rri || 0,
                risk_level: primaryReading?.risk_level || 'Safe',
                risk_color: primaryReading?.risk_color || '#10b981',
                dominant: primaryReading?.dominant || 'None'
            },
            trend: (primaryReading?.rri || 0) > 50 ? 'up' : 'stable',
            history: history,
            forecast: generatePlaceholderForecast(),
            alerts: alerts.map(a => ({
                id: a.id,
                type: a.type,
                message: a.message,
                severity: a.severity,
                timestamp: a.created_at
            })),
            sectors: sectors,
            nodes: nodes.map(n => ({
                id: n.id,
                location_name: locations.find(l => l.id === n.location_id)?.name || 'Assigned',
                type: 'outdoor',
                status: n.status === 'online' ? 'active' : 'offline',
                battery: 88 + Math.floor(Math.random() * 10),
                lastPing: n.last_sync
            })),
            userProfile: profile
        };

        res.status(200).json(fullData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const generatePlaceholderForecast = () => {
    const now = Date.now();
    return Array.from({ length: 6 }).map((_, i) => ({
        timestamp: new Date(now + (i + 1) * 3600000).toISOString(),
        aqi: 30 + Math.floor(Math.random() * 20),
        rri: 20 + Math.floor(Math.random() * 15),
        pm25: 10 + Math.random() * 10,
        confidence: 90 - i * 5
    }));
};

const getHistory = (req, res) => {
    try {
        const range = req.query.range || '24h';
        const readings = Reading.findAll(); // In production, filter by range
        
        const history = readings.map(r => ({
            timestamp: r.created_at,
            pm25: r.pm25,
            co: r.co,
            o3: r.o3,
            aqi: r.aqi,
            rri: r.rri,
            temperature: r.temperature,
            humidity: r.humidity
        })).slice(-24); // Last 24 points

        res.status(200).json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getForecast = (req, res) => {
    // Return mock-live forecast (stable for session)
    const now = Date.now();
    const forecast = Array.from({ length: 6 }).map((_, i) => ({
        timestamp: new Date(now + (i + 1) * 3600000).toISOString(),
        aqi: 30 + Math.floor(Math.random() * 20),
        rri: 20 + Math.floor(Math.random() * 15),
        pm25: 10 + Math.random() * 10,
        confidence: 90 - i * 5
    }));
    res.status(200).json({ success: true, data: forecast });
};

const getSectors = (req, res) => {
    try {
        const locations = Location.findAll();
        const latestReadings = Reading.findAll();
        
        const sectors = locations.map(loc => {
            const node = SensorNode.findByLocation(loc.id)[0];
            const reading = node ? latestReadings.find(r => r.node_id === node.id) : null;
            
            return {
                id: loc.id,
                name: loc.name,
                aqi: reading ? reading.aqi : 0,
                rri: reading ? reading.rri : 0,
                status: reading ? reading.risk_level : 'Safe',
                lat: loc.lat,
                lng: loc.lng
            };
        });

        res.status(200).json({ success: true, data: sectors });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getNodes = (req, res) => {
    try {
        const nodes = SensorNode.findAll();
        const response = nodes.map(n => ({
            id: n.id,
            name: `${n.id === 'node-01' ? 'Alpha' : n.id === 'node-02' ? 'Beta' : 'Gamma'}-Primary`,
            type: n.id === 'node-04' ? 'indoor' : 'outdoor',
            status: n.status === 'online' ? 'active' : 'offline',
            battery: 85 + Math.floor(Math.random() * 15),
            lastPing: n.last_sync
        }));
        res.status(200).json({ success: true, data: response });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getProfile = (req, res) => {
    try {
        const profile = Profile.findById(req.params.id) || Profile.findAll()[0];
        res.status(200).json({ success: true, data: profile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const upsertProfile = (req, res) => {
    try {
        const data = req.body;
        if (!data.id) data.id = 'default-user';
        
        const existing = Profile.findById(data.id);
        let result;
        if (existing) {
            result = Profile.update(data.id, data);
        } else {
            result = Profile.create(data);
        }
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getLatestData,
    getHistory,
    getForecast,
    getSectors,
    getNodes,
    getProfile,
    upsertProfile
};
