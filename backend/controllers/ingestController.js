/**
 * AERIS Backend — Sensor Ingestion Controller
 * ────────────────────────────────────────────────────────────────
 * Processes HTTP POST payloads from ESP32 sensor nodes.
 *
 * Pipeline:
 *   ESP32 → POST /ingest → Zod validation → AQI/RRI calc
 *         → Firestore persistence → WebSocket broadcast
 *
 * Payload Contract (nested — legacy):
 *   {
 *     node_id: string,
 *     sensors:      { pm25, co, o3, no2?, voc_index },
 *     environment:  { temperature, humidity, oxygen?, pressure? }
 *   }
 *
 * Payload Contract (flat — ESP32 hardware):
 *   {
 *     node_id, pm25, co, o3 (ppb), nox, voc,
 *     temperature, humidity, rain?, pm25_rain_delta?
 *   }
 */

const { z } = require('zod');
const { calculateRiskMetrics } = require('../utils/riskEngine');
const { broadcastEnvironmentUpdate } = require('../websocket/socketService');
const { getContainer, isConfigured } = require('../config/cosmosdb');
const { geolocateIp, getEspLocation, setEspLocation } = require('../utils/geolocate');
const { NODE_LOCATIONS } = require('../config/nodeLocations');

// ── Validation Schema ───────────────────────────────────────────
const sensorSchema = z.object({
  pm25: z.number().min(0).max(500, 'PM2.5 must be 0–500 µg/m³'),
  co: z.number().min(0).max(100, 'CO must be 0–100 ppm'),
  o3: z.number().min(0).max(1, 'O3 must be 0–1 ppm'),
  no2: z.number().min(0).max(10000, 'NO2 must be 0–10000 ppb').optional(),
  voc_index: z.number().min(0).max(500, 'VOC index must be 0–500'),
});

const environmentSchema = z.object({
  temperature: z.number().min(-50).max(60),
  humidity: z.number().min(0).max(100),
  oxygen: z.number().min(0).max(100).optional(),
  pressure: z.number().min(300).max(1100).optional(),
  rain: z.boolean().optional(),
  pm25_rain_delta: z.number().min(0).max(500).optional(),
});

const ingestPayloadSchema = z.object({
  node_id: z.string().min(1, 'node_id is required'),
  sensors: sensorSchema,
  environment: environmentSchema,
});

// ── Ingestion Logic ─────────────────────────────────────────────

const ingestData = async (req, res) => {
  try {
    // ── Auto-detect flat JSON from ESP32 hardware ────────────────
    // ESP32 sends: { node_id, pm25, co, o3 (ppb), nox, voc, temperature, humidity, rain, pm25_rain_delta }
    // Controller expects nested: { node_id, sensors: {...}, environment: {...} }
    let body = req.body;
    if (body.node_id && !body.sensors && body.pm25 !== undefined) {
      body = {
        node_id: body.node_id,
        sensors: {
          pm25: body.pm25,
          co: body.co,
          o3: (body.o3 || 0) / 1000,             // ESP32 sends ppb → convert to ppm for schema
          no2: body.nox || body.no2 || 0,         // ESP32 field is 'nox'
          voc_index: body.voc || body.voc_index || 0,  // ESP32 field is 'voc'
        },
        environment: {
          temperature: body.temperature || 0,
          humidity: body.humidity || 0,
          oxygen: body.oxygen,
          pressure: body.pressure,
          rain: body.rain,
          pm25_rain_delta: body.pm25_rain_delta,
        },
      };
    }

    // 1. Validate incoming ESP32 payload
    const payload = ingestPayloadSchema.parse(body);

    // 2. Normalize values (strict 2-decimal precision)
    const norm = (val) => Number(val.toFixed(2));

    const normalized = {
      pm25: norm(payload.sensors.pm25),
      co: norm(payload.sensors.co),
      o3: norm(payload.sensors.o3 * 1000),      // ppm → ppb for storage + display
      no2: norm(payload.sensors.no2 || 0),       // ppb from ESP32
      vocIndex: norm(payload.sensors.voc_index),
      temperature: norm(payload.environment.temperature),
      humidity: norm(payload.environment.humidity),
      oxygen: payload.environment.oxygen != null ? norm(payload.environment.oxygen) : null,
      pressure: payload.environment.pressure != null ? norm(payload.environment.pressure) : null,
      rain: payload.environment.rain || false,
      pm25RainDelta: payload.environment.pm25_rain_delta != null ? norm(payload.environment.pm25_rain_delta) : 0,
    };

    // 3. Compute AQI + RRI via risk engine
    //    O3 already converted to ppb in normalized above
    const riskMetrics = calculateRiskMetrics({
      pm25: normalized.pm25,
      co: normalized.co,
      o3: normalized.o3,           // already ppb
      vocIndex: normalized.vocIndex,
    });

    // 4. Server-assigned timestamp
    const timestampISO = new Date().toISOString();

    // 5. Geolocate ESP32 — priority: static NODE_LOCATIONS config > cache > IP lookup
    //    Static config gives exact device coordinates (not city-level IP geo).
    const staticLoc = NODE_LOCATIONS[payload.node_id];
    let geo;
    if (staticLoc) {
      // Exact coordinates from env config — use directly, no network call needed
      geo = { lat: staticLoc.lat, lng: staticLoc.lng, city: staticLoc.name, region: '', country: '' };
      setEspLocation({ ...geo, nodeId: payload.node_id });
    } else {
      // Fall back to in-memory cache, then IP geolocation (city-level accuracy)
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
      geo = getEspLocation(payload.node_id);
      if (!geo) {
        try { geo = await geolocateIp(clientIp); } catch (_) {}
      }
      if (geo) setEspLocation({ ...geo, nodeId: payload.node_id });
    }

    // 6. Persist to Azure Cosmos DB — SensorData/LiveLogs
    //    Partition key: /sensorId  |  TTL: 7 days (604800 s)
    const cosmosDoc = {
      id:          `${payload.node_id}-${Date.now()}`,
      sensorId:    payload.node_id,   // partition key
      timestamp:   timestampISO,
      pm25:        normalized.pm25,
      co:          normalized.co,
      o3:          normalized.o3,
      no2:         normalized.no2,
      vocIndex:    normalized.vocIndex,
      temperature: normalized.temperature,
      humidity:    normalized.humidity,
      oxygen:      normalized.oxygen,
      pressure:    normalized.pressure,
      rain:        normalized.rain,
      pm25RainDelta: normalized.pm25RainDelta,
      aqi:         riskMetrics.aqi,
      aqiCategory: riskMetrics.aqiCategory,
      rri:         riskMetrics.rri,
      riskLevel:   riskMetrics.riskLevel,
      lat:         geo?.lat || null,
      lng:         geo?.lng || null,
      city:        geo?.city || null,
      region:      geo?.region || null,
      ttl:         604800,            // auto-delete after 7 days
    };

    // 7. Persist to Azure Cosmos DB
    const container = await getContainer();
    await container.items.create(cosmosDoc);

    // 8. Broadcast over WebSocket to all connected frontends
    //    Include 'nox' alias so frontend useLiveData can pick up either field name
    const wsPayload = {
      nodeId: payload.node_id,
      timestamp: timestampISO,
      sensors: {
        ...normalized,
        nox: normalized.no2,         // frontend checks nox || no2
        voc: normalized.vocIndex,    // frontend checks vocIndex || voc || voc_index
      },
      derived: riskMetrics,
      geo: geo ? { lat: geo.lat, lng: geo.lng, city: geo.city, region: geo.region } : null,
    };
    broadcastEnvironmentUpdate(wsPayload);

    // 9. Return success
    return res.status(201).json({
      success: true,
      message: 'Telemetry ingested and persisted',
      data: {
        nodeId: payload.node_id,
        timestamp: timestampISO,
        aqi: riskMetrics.aqi,
        aqiCategory: riskMetrics.aqiCategory,
        rri: riskMetrics.rri,
        riskLevel: riskMetrics.riskLevel,
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sensor payload',
        errors: (error.issues || error.errors || []).map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    console.error('[INGEST] Processing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during ingestion',
    });
  }
};

module.exports = { ingestData };

