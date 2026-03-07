/**
 * AERIS Backend — Sensor Ingestion Controller
 * ────────────────────────────────────────────────────────────────
 * Processes HTTP POST payloads from ESP32 sensor nodes.
 *
 * Pipeline:
 *   ESP32 → POST /ingest → Zod validation → AQI/RRI calc
 *         → Firestore persistence → WebSocket broadcast
 *
 * Payload Contract:
 *   {
 *     node_id: string,
 *     sensors:      { pm25, co, o3, voc_index },
 *     environment:  { temperature, humidity, oxygen?, pressure? }
 *   }
 */

const { z } = require('zod');
const { calculateRiskMetrics } = require('../utils/riskEngine');
const { broadcastEnvironmentUpdate } = require('../websocket/socketService');
const { getContainer, isConfigured } = require('../config/cosmosdb');
const { geolocateIp, setEspLocation } = require('../utils/geolocate');

// ── Validation Schema ───────────────────────────────────────────
const sensorSchema = z.object({
  pm25: z.number().min(0).max(500, 'PM2.5 must be 0–500 µg/m³'),
  co: z.number().min(0).max(100, 'CO must be 0–100 ppm'),
  o3: z.number().min(0).max(1, 'O3 must be 0–1 ppm'),
  voc_index: z.number().min(0).max(500, 'VOC index must be 0–500'),
});

const environmentSchema = z.object({
  temperature: z.number().min(-50).max(60),
  humidity: z.number().min(0).max(100),
  oxygen: z.number().min(0).max(100).optional(),
  pressure: z.number().min(300).max(1100).optional(),
});

const ingestPayloadSchema = z.object({
  node_id: z.string().min(1, 'node_id is required'),
  sensors: sensorSchema,
  environment: environmentSchema,
});

// ── Ingestion Logic ─────────────────────────────────────────────

const ingestData = async (req, res) => {
  try {
    // 1. Validate incoming ESP32 payload
    const payload = ingestPayloadSchema.parse(req.body);

    // 2. Normalize values (strict 2-decimal precision)
    const norm = (val) => Number(val.toFixed(2));

    const normalized = {
      pm25: norm(payload.sensors.pm25),
      co: norm(payload.sensors.co),
      o3: norm(payload.sensors.o3),
      vocIndex: norm(payload.sensors.voc_index),
      temperature: norm(payload.environment.temperature),
      humidity: norm(payload.environment.humidity),
      oxygen: payload.environment.oxygen != null ? norm(payload.environment.oxygen) : null,
      pressure: payload.environment.pressure != null ? norm(payload.environment.pressure) : null,
    };

    // 3. Compute AQI + RRI via risk engine
    //    riskEngine expects o3 in ppb-scale internally;
    //    payload sends o3 in ppm (0–1), so convert: ppm × 1000 = ppb
    const riskMetrics = calculateRiskMetrics({
      pm25: normalized.pm25,
      co: normalized.co,
      o3: normalized.o3 * 1000,   // ppm → ppb for engine
      vocIndex: normalized.vocIndex,
    });

    // 4. Server-assigned timestamp
    const timestampISO = new Date().toISOString();

    // 5. Persist to Azure Cosmos DB — SensorData/LiveLogs
    //    Partition key: /sensorId  |  TTL: 7 days (604800 s)
    const cosmosDoc = {
      id:          `${payload.node_id}-${Date.now()}`,
      sensorId:    payload.node_id,   // partition key
      timestamp:   timestampISO,
      pm25:        normalized.pm25,
      co:          normalized.co,
      o3:          normalized.o3,
      vocIndex:    normalized.vocIndex,
      temperature: normalized.temperature,
      humidity:    normalized.humidity,
      oxygen:      normalized.oxygen,
      pressure:    normalized.pressure,
      aqi:         riskMetrics.aqi,
      aqiCategory: riskMetrics.aqiCategory,
      rri:         riskMetrics.rri,
      riskLevel:   riskMetrics.riskLevel,
      ttl:         604800,            // auto-delete after 7 days
    };

    // 6. Persist to Azure Cosmos DB
    const container = await getContainer();
    await container.items.create(cosmosDoc);

    // 7. Broadcast over WebSocket to all connected frontends
    const wsPayload = {
      type: 'TELEMETRY_UPDATE',
      nodeId: payload.node_id,
      timestamp: timestampISO,
      sensors: normalized,
      derived: riskMetrics,
    };
    broadcastEnvironmentUpdate(wsPayload);

    // 8. Geolocate the ESP32's public IP (non-blocking, cached)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    geolocateIp(clientIp).then(geo => {
      if (geo) setEspLocation({ ...geo, nodeId: payload.node_id });
    }).catch(() => {});

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
        errors: error.errors.map(e => ({
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

