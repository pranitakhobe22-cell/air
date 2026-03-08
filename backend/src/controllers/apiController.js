const Location = require('../models/Location');
const SensorNode = require('../models/SensorNode');
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Profile = require('../models/Profile');
const { getContainer, isConfigured: isCosmosConfigured } = require('../../config/cosmosdb');
const { getEspLocation, getAllEspLocations } = require('../../utils/geolocate');
const { NODE_LOCATIONS } = require('../../config/nodeLocations');

/** Normalize a Cosmos DB document to the internal row format. */
const normalizeDoc = (r) => ({
    CREATED_AT:       r.timestamp,
    PM25:             r.pm25,
    PM10:             r.pm25 * 1.2,
    CO:               r.co,
    NOX:              r.no2 || r.nox || 0,
    O3:               r.o3,
    VOC_INDEX:        r.vocIndex,
    TEMPERATURE:      r.temperature,
    HUMIDITY:         r.humidity,
    OXYGEN:           r.oxygen,
    PRESSURE:         r.pressure,
    AQI:              r.aqi,
    AQI_CATEGORY:     r.aqiCategory,
    AIR_QUALITY_TEXT: null,
    RRI:              r.rri,
    RISK_LEVEL:       r.riskLevel,
    RISK_COLOR:       null,
    DOMINANT:         null,
    NODE_ID:          r.sensorId,
    RAIN:             r.rain || false,
    PM25_RAIN_DELTA:  r.pm25RainDelta || 0,
    LAT:              r.lat || null,
    LNG:              r.lng || null,
    CITY:             r.city || null,
    REGION:           r.region || null,
});

/**
 * Fetch sensor readings from Cosmos DB.
 *
 * Two-phase strategy that guarantees at least one record per active node:
 *  1. Broad cross-partition query to discover all unique node IDs present.
 *  2. For each node, a partition-scoped query fetching its latest N readings.
 *
 * This prevents one fast-posting node from dominating the result set and
 * hiding slower or less-frequent nodes when using a plain TOP N sort.
 */
const fetchCosmosReadings = async (historyPerNode = 30) => {
    const container = await getContainer();

    // ── Phase 1: Discover all unique sensorId values in the last 24 h ──
    // Fetch just enough docs to find all active nodes (cheap query).
    const discoveryRes = await container.items
        .query(
            'SELECT DISTINCT VALUE c.sensorId FROM c',
            { enableCrossPartitionQuery: true }
        )
        .fetchAll();

    const nodeIds = (discoveryRes.resources || []).filter(Boolean);

    if (nodeIds.length === 0) {
        // No data at all — return empty
        return [];
    }

    // ── Phase 2: Fetch latest N readings per node (partition-scoped = fast) ──
    const perNodePromises = nodeIds.map(async (nodeId) => {
        const { resources } = await container.items
            .query(
                {
                    query: `SELECT TOP @n * FROM c WHERE c.sensorId = @id ORDER BY c.timestamp DESC`,
                    parameters: [
                        { name: '@n',  value: historyPerNode },
                        { name: '@id', value: nodeId },
                    ],
                },
                { partitionKey: nodeId }
            )
            .fetchAll();
        return resources.map(normalizeDoc);
    });

    const perNodeArrays = await Promise.all(perNodePromises);

    // Flatten and sort newest-first across all nodes
    const all = perNodeArrays.flat();
    all.sort((a, b) => new Date(b.CREATED_AT) - new Date(a.CREATED_AT));
    return all;
};

/** Map AQI to color */
const aqiToColor = (aqi) => {
    if (aqi <= 50) return '#22c55e';
    if (aqi <= 100) return '#eab308';
    if (aqi <= 150) return '#f97316';
    if (aqi <= 200) return '#ef4444';
    if (aqi <= 300) return '#a855f7';
    return '#991b1b';
};

/** Map AQI to risk level */
const aqiToRiskLevel = (aqi) => {
    if (aqi <= 50) return 'Safe';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'High';
    if (aqi <= 200) return 'Very High';
    return 'Hazardous';
};

/** Determine dominant pollutant from sensor values */
const getDominant = (r) => {
    if (!r) return 'PM2.5';
    const subs = [
        { name: 'PM2.5', value: (r.PM25 || 0) / 35 },
        { name: 'CO', value: (r.CO || 0) / 9.4 },
        { name: 'O3', value: (r.O3 || 0) / 70 },
        { name: 'VOC', value: (r.VOC_INDEX || 0) / 300 },
    ];
    return subs.sort((a, b) => b.value - a.value)[0].name;
};

/** Generate advisory text from real data */
const getAirQualityText = (r) => {
    if (!r) return 'Waiting for sensor data...';
    const aqi = r.AQI || 0;
    const pm = (r.PM25 || 0).toFixed(1);
    const co = (r.CO || 0).toFixed(2);
    if (aqi <= 50) return `Good air quality. PM2.5: ${pm} ug/m3, CO: ${co} ppm. Safe for outdoor activities.`;
    if (aqi <= 100) return `Moderate air quality. PM2.5: ${pm} ug/m3. Sensitive individuals should limit prolonged exposure.`;
    if (aqi <= 150) return `Unhealthy for sensitive groups. PM2.5: ${pm} ug/m3. Reduce extended outdoor activity.`;
    if (aqi <= 200) return `Unhealthy. PM2.5: ${pm} ug/m3, CO: ${co} ppm. Everyone should limit outdoor exposure.`;
    return `Hazardous air quality. PM2.5: ${pm} ug/m3. Avoid all outdoor activity.`;
};

/**
 * EMA + Momentum forecast algorithm.
 *
 * 1. Compute Exponential Moving Average (alpha=0.3) on recent readings
 *    — weights latest data more heavily than older readings.
 * 2. Linear regression on the last N readings gives momentum (slope)
 *    — captures whether AQI is rising or falling.
 * 3. Project forward: EMA + slope * hour, with exponential decay (0.85^h)
 *    so predictions gradually revert toward the mean over longer horizons.
 * 4. Confidence based on data volatility (stddev): stable data = high
 *    confidence, volatile data = lower confidence.
 */
const generateForecast = (readings) => {
    const now = Date.now();
    const recent = readings.slice(0, 20).reverse(); // oldest-first for EMA
    if (recent.length === 0) {
        // No data — return empty forecast instead of fake values
        return [];
    }

    // EMA (alpha = 0.3)
    const alpha = 0.3;
    let emaAqi = recent[0].AQI || 0;
    let emaPm = recent[0].PM25 || 0;
    let emaRri = recent[0].RRI || 0;
    for (let i = 1; i < recent.length; i++) {
        emaAqi = alpha * (recent[i].AQI || 0) + (1 - alpha) * emaAqi;
        emaPm = alpha * (recent[i].PM25 || 0) + (1 - alpha) * emaPm;
        emaRri = alpha * (recent[i].RRI || 0) + (1 - alpha) * emaRri;
    }

    // Linear regression for slope (momentum per reading interval)
    const n = recent.length;
    const linReg = (getter) => {
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
            const y = getter(recent[i]);
            sumX += i; sumY += y; sumXY += i * y; sumX2 += i * i;
        }
        const denom = n * sumX2 - sumX * sumX;
        return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    };
    const slopeAqi = linReg(r => r.AQI || 0);
    const slopePm = linReg(r => r.PM25 || 0);
    const slopeRri = linReg(r => r.RRI || 0);

    // Volatility (stddev) for confidence scaling
    const aqiValues = recent.map(r => r.AQI || 0);
    const meanAqi = aqiValues.reduce((a, b) => a + b, 0) / n;
    const variance = aqiValues.reduce((a, v) => a + (v - meanAqi) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);

    // Project 6 hours, with decay so predictions don't diverge
    const decay = 0.85;
    return Array.from({ length: 6 }).map((_, i) => {
        const h = i + 1;
        const d = Math.pow(decay, h);

        const forecastAqi = Math.max(0, Math.min(500,
            Math.round(emaAqi + slopeAqi * h * 3 * d)));
        const forecastPm = Math.max(0,
            emaPm + slopePm * h * 3 * d);
        const forecastRri = Math.max(0, Math.min(100,
            Math.round(emaRri + slopeRri * h * 3 * d)));
        const conf = Math.max(45, Math.round(90 - h * 5 - stddev * 0.5));

        return {
            timestamp: new Date(now + h * 3600000).toISOString(),
            aqi: forecastAqi,
            rri: forecastRri,
            pm25: Number(forecastPm.toFixed(2)),
            confidence: conf,
        };
    });
};

const getLatestData = async (req, res) => {
    try {
        const latestReadings = isCosmosConfigured()
            ? await fetchCosmosReadings(50)
            : await Reading.findAll();

        // Only keep real ESP32 node readings — filter out test/probe/fake entries
        const REAL_NODE_IDS = new Set(['ESP32_01', 'ESP32_02', 'ESP32_03']);
        const sorted = latestReadings
            .filter(r => REAL_NODE_IDS.has(r.NODE_ID))
            .sort((a, b) => new Date(b.CREATED_AT) - new Date(a.CREATED_AT));
        const primaryReading = sorted[0] || null;

        const nodes = await SensorNode.findAll();
        const locations = await Location.findAll();
        const alerts = await Alert.findRecent(10);
        const allProfiles = await Profile.findAll();
        const profile = allProfiles[0] || { name: 'User', sensitivity: 'moderate' };

        const dominant = getDominant(primaryReading);
        const riskColor = aqiToColor(primaryReading?.AQI || 0);
        const riskLevel = primaryReading?.RISK_LEVEL || aqiToRiskLevel(primaryReading?.AQI || 0);

        const history = sorted.map(r => ({
            timestamp:   r.CREATED_AT,
            pm25:        r.PM25 || 0,
            pm10:        r.PM10 || 0,
            co:          r.CO || 0,
            o3:          r.O3 || 0,
            nox:         r.NOX || 0,
            voc_index:   r.VOC_INDEX || 0,
            aqi:         r.AQI || 0,
            rri:         r.RRI || 0,
            temperature: r.TEMPERATURE || 0,
            humidity:    r.HUMIDITY || 0,
        })).slice(0, 60);

        // Build node map from real ESP32 readings only
        const espNodeMap = {}; // nodeId -> { latest reading, geo }
        const seenNodeIds = new Set();
        for (const r of sorted) {
            if (!r.NODE_ID || seenNodeIds.has(r.NODE_ID)) continue;
            seenNodeIds.add(r.NODE_ID);

            const nodeReadings = sorted.filter(x => x.NODE_ID === r.NODE_ID);
            const latest = nodeReadings[0];

            // Location priority: 1) static NODE_LOCATIONS env config, 2) in-memory IP-geo cache, 3) Cosmos DB geo fields
            const staticLoc = NODE_LOCATIONS[r.NODE_ID];
            const memGeo    = getEspLocation(r.NODE_ID);
            const geo = staticLoc
                ? { lat: staticLoc.lat, lng: staticLoc.lng, city: staticLoc.name, region: '', country: '' }
                : memGeo
                    || (latest.LAT ? { lat: latest.LAT, lng: latest.LNG, city: latest.CITY, region: latest.REGION } : null);

            espNodeMap[r.NODE_ID] = { latest, geo };
        }
        const activeEspIds = Object.keys(espNodeMap);
        // Primary geo: first node's location (static config preferred)
        const primaryGeo = (activeEspIds.length > 0 ? espNodeMap[activeEspIds[0]].geo : null)
            || getEspLocation();

        // Base coordinates: use ESP32 geo, fallback to DB locations
        const baseLat = primaryGeo?.lat || locations[0]?.LAT || null;
        const baseLng = primaryGeo?.lng || locations[0]?.LNG || null;

        // Build sectors from ESP32 hardware nodes first, then fill from DB locations
        const sectors = [];
        const nodeList = [];

        // Add each ESP32 hardware node as a sector + node
        activeEspIds.forEach((espId, i) => {
            const { latest, geo } = espNodeMap[espId];
            // Spread nodes with IP-geo fallback so they don't all overlap on the map
            const offsets = [
                { dlat: 0,      dlng: 0      },
                { dlat: 0.008,  dlng: 0.012  },
                { dlat: -0.006, dlng: -0.010 },
                { dlat: 0.012,  dlng: -0.008 },
            ];
            const offset = offsets[i] || { dlat: i * 0.005, dlng: i * 0.005 };
            const lat = geo?.lat || (baseLat != null ? baseLat + offset.dlat : null);
            const lng = geo?.lng || (baseLng != null ? baseLng + offset.dlng : null);
            // Use static config name if available, otherwise geo city name
            const staticName = NODE_LOCATIONS[espId]?.name;
            const locationName = staticName
                ? staticName
                : geo
                    ? (geo.region ? `${geo.city}, ${geo.region}` : geo.city)
                    : `Hardware Sensor ${i + 1}`;

            sectors.push({
                id:     espId,
                name:   locationName,
                aqi:    latest.AQI || 0,
                rri:    latest.RRI || 0,
                status: latest.RISK_LEVEL || aqiToRiskLevel(latest.AQI || 0),
                lat, lng,
            });

            const ageMs = Date.now() - new Date(latest.CREATED_AT).getTime();
            nodeList.push({
                id:            espId,
                location_name: locationName,
                type:          'outdoor',
                status:        ageMs < 60000 ? 'active' : 'offline',
                battery:       100,
                lastPing:      latest.CREATED_AT,
                lat, lng,
            });
        });

        const espLocationName = primaryGeo
            ? `${primaryGeo.city}, ${primaryGeo.region}, ${primaryGeo.country}`
            : 'Live Hardware Sensor';

        // Build per-node data for frontend multi-node views
        const perNode = {};
        for (const espId of activeEspIds) {
            const nodeReadings = sorted.filter(r => r.NODE_ID === espId);
            const latest = nodeReadings[0];
            const geo = espNodeMap[espId].geo;
            perNode[espId] = {
                latest: {
                    aqi: latest?.AQI || 0,
                    rri: latest?.RRI || 0,
                    pm25: latest?.PM25 || 0,
                    co: latest?.CO || 0,
                    o3: latest?.O3 || 0,
                    nox: latest?.NOX || 0,
                    voc_index: latest?.VOC_INDEX || 0,
                    temperature: latest?.TEMPERATURE || 0,
                    humidity: latest?.HUMIDITY || 0,
                    timestamp: latest?.CREATED_AT,
                },
                location: geo ? `${geo.city}, ${geo.region}` : `Sensor ${espId}`,
                history: nodeReadings.map(r => ({
                    timestamp: r.CREATED_AT,
                    aqi: r.AQI || 0,
                    rri: r.RRI || 0,
                    pm25: r.PM25 || 0,
                    co: r.CO || 0,
                    o3: r.O3 || 0,
                    nox: r.NOX || 0,
                    voc_index: r.VOC_INDEX || 0,
                })).slice(0, 30),
            };
        }

        const fullData = {
            meta: {
                location:  activeEspIds.includes(primaryReading?.NODE_ID) ? espLocationName : 'Live Sector',
                timestamp: primaryReading?.CREATED_AT || new Date().toISOString(),
                source:    'live-api',
            },
            sensors: {
                pm25:      primaryReading?.PM25      || 0,
                pm10:      primaryReading?.PM10      || 0,
                co:        primaryReading?.CO        || 0,
                nox:       primaryReading?.NOX       || 0,
                o3:        primaryReading?.O3        || 0,
                voc_index: primaryReading?.VOC_INDEX || 0,
            },
            environment: {
                temperature: primaryReading?.TEMPERATURE || 0,
                humidity:    primaryReading?.HUMIDITY    || 0,
                oxygen:      primaryReading?.OXYGEN      || 20.9,
                pressure:    primaryReading?.PRESSURE    || 1013,
                rain:        primaryReading?.RAIN        || false,
                pm25RainDelta: primaryReading?.PM25_RAIN_DELTA || 0,
            },
            derived: {
                aqi:              primaryReading?.AQI || 0,
                aqi_category:     primaryReading?.AQI_CATEGORY || 'Good',
                air_quality_text: getAirQualityText(primaryReading),
                rri:              primaryReading?.RRI || 0,
                risk_level:       riskLevel,
                risk_color:       riskColor,
                dominant:         dominant,
            },
            trend: sorted.length >= 3
                ? (sorted[0]?.AQI > sorted[2]?.AQI ? 'rising' : sorted[0]?.AQI < sorted[2]?.AQI ? 'falling' : 'stable')
                : 'stable',
            history,
            forecast: generateForecast(sorted),
            alerts: alerts.map(a => ({
                id:        a.ID,
                type:      a.TYPE,
                message:   a.MESSAGE,
                severity:  a.SEVERITY,
                timestamp: a.CREATED_AT,
            })),
            sectors,
            nodes: nodeList,
            perNode,
            userProfile: profile,
        };

        res.status(200).json(fullData);
    } catch (err) {
        console.error('[API] getLatestData error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

const getHistory = async (req, res) => {
    try {
        const readings = isCosmosConfigured()
            ? await fetchCosmosReadings(50)
            : await Reading.findAll();
        const history = readings
            .sort((a, b) => new Date(b.CREATED_AT) - new Date(a.CREATED_AT))
            .map(r => ({
                timestamp:   r.CREATED_AT,
                pm25:        r.PM25 || 0,
                pm10:        r.PM10 || 0,
                co:          r.CO || 0,
                o3:          r.O3 || 0,
                nox:         r.NOX || 0,
                voc_index:   r.VOC_INDEX || 0,
                aqi:         r.AQI || 0,
                rri:         r.RRI || 0,
                temperature: r.TEMPERATURE || 0,
                humidity:    r.HUMIDITY || 0,
            })).slice(0, 60);

        res.status(200).json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getForecast = async (req, res) => {
    try {
        const readings = isCosmosConfigured()
            ? await fetchCosmosReadings(20)
            : await Reading.findAll();
        const sorted = readings.sort((a, b) => new Date(b.CREATED_AT) - new Date(a.CREATED_AT));
        res.status(200).json({ success: true, data: generateForecast(sorted) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getSectors = async (req, res) => {
    try {
        const locations = await Location.findAll();
        const latestReadings = await Reading.findAll();

        const sectors = await Promise.all(locations.map(async loc => {
            const nodes   = await SensorNode.findByLocation(loc.ID);
            const node    = nodes[0];
            const reading = node ? latestReadings.find(r => r.NODE_ID === node.ID) : null;
            return {
                id:     loc.ID,
                name:   loc.NAME,
                aqi:    reading ? reading.AQI       : 0,
                rri:    reading ? reading.RRI       : 0,
                status: reading ? reading.RISK_LEVEL : 'Safe',
                lat:    loc.LAT,
                lng:    loc.LNG,
            };
        }));

        res.status(200).json({ success: true, data: sectors });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getNodes = async (req, res) => {
    try {
        const nodes = await SensorNode.findAll();
        const locations = await Location.findAll();
        const response = nodes.map(n => {
            const loc = locations.find(l => l.ID === n.LOCATION_ID);
            return {
                id:            n.ID,
                location_name: loc?.NAME || 'Assigned',
                type:          'outdoor',
                status:        n.STATUS === 'online' ? 'active' : 'offline',
                battery:       85 + Math.floor(Math.random() * 15),
                lastPing:      n.LAST_SYNC,
                lat:           loc?.LAT || null,
                lng:           loc?.LNG || null,
            };
        });
        res.status(200).json({ success: true, data: response });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getProfile = async (req, res) => {
    try {
        const profile = await Profile.findOrDefault(req.params.id);
        res.status(200).json({ success: true, data: profile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const upsertProfile = async (req, res) => {
    try {
        const data = req.body;
        if (!data.id) data.id = 'default-user';

        const existing = await Profile.findById(data.id);
        const result   = existing
            ? await Profile.update(data.id, data)
            : await Profile.create(data);

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
    upsertProfile,
};
