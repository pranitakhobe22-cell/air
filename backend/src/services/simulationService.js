const SensorNode = require('../models/SensorNode');
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const riskEngine = require('./riskEngine');

/**
 * Demo Sensor Simulation Service
 * Generates realistic environmental telemetry every 8 seconds.
 */
class SimulationService {
    constructor() {
        this.interval = null;
        this.baseValues = {
            pm25: 12, pm10: 22, co: 0.4, nox: 15,
            o3: 28, voc_index: 45, temperature: 24,
            humidity: 45, oxygen: 20.9, pressure: 1013,
        };
    }

    start() {
        console.log('🛰️  [Simulation] Background generator service started (8s interval)');
        this.interval = setInterval(() => this.tick(), 8000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    async tick() {
        try {
            const nodes = await SensorNode.findAll();

            for (const node of nodes) {
                if (node.STATUS === 'offline') continue;

                const lastReading = await Reading.findLatestByNode(node.ID) || this.baseValues;

                const jitter = (val, maxChange = 0.05) =>
                    val * (1 + (Math.random() * maxChange * 2 - maxChange));

                // Jitter around base values (not last reading) to prevent unbounded drift
                let pm25      = jitter(this.baseValues.pm25);
                let pm10      = jitter(this.baseValues.pm10);
                let co        = jitter(this.baseValues.co);
                let nox       = jitter(this.baseValues.nox);
                let o3        = jitter(this.baseValues.o3);
                let voc_index = jitter(this.baseValues.voc_index);

                // Occasional spike — capped at realistic maximums
                if (Math.random() > 0.9) {
                    pm25 += 30 + Math.random() * 20;
                    console.log(`⚠️  [Simulation] ANOMALY DETECTED: PM2.5 Spike on ${node.ID}`);
                }

                // Hard clamp to realistic ranges
                pm25      = Math.min(pm25, 300);
                pm10      = Math.min(pm10, 400);
                co        = Math.min(co, 50);
                nox       = Math.min(nox, 200);
                o3        = Math.min(o3, 300);
                voc_index = Math.min(voc_index, 500);

                const rawTelemetry = {
                    node_id:     node.ID,
                    pm25:        parseFloat(pm25.toFixed(2)),
                    pm10:        parseFloat(pm10.toFixed(2)),
                    co:          parseFloat(co.toFixed(2)),
                    nox:         parseFloat(nox.toFixed(2)),
                    o3:          parseFloat(o3.toFixed(2)),
                    voc_index:   parseFloat(voc_index.toFixed(2)),
                    temperature: parseFloat(jitter(this.baseValues.temperature, 0.01).toFixed(1)),
                    humidity:    parseFloat(jitter(this.baseValues.humidity,    0.02).toFixed(1)),
                    oxygen:      20.9,
                    pressure:    1013,
                };

                const intelligence  = riskEngine.processReadingIntelligence(rawTelemetry);
                const finalReading  = { ...rawTelemetry, ...intelligence };

                await Reading.create(finalReading);
                await this.validateThresholds(node.ID, finalReading, lastReading);
                await SensorNode.updateStatus(node.ID, 'online');
            }
        } catch (err) {
            console.error(`❌ [Simulation] Tick error: ${err.message}`);
        }
    }

    async validateThresholds(nodeId, reading, lastReading) {
        const createAlert = async (type, severity, message) => {
            await Alert.create({ type, severity, message });
            console.log(`🚨 [Alert] ${severity.toUpperCase()}: ${message}`);
        };

        if (reading.pm25 > 100) {
            await createAlert('SEVERE_POLLUTION', 'critical',
                `Critical PM2.5 levels detected at ${nodeId}: ${reading.pm25} µg/m³`);
        }
        if (reading.co > 35) {
            await createAlert('TOXIC_GAS', 'critical',
                `Hazardous CO levels at ${nodeId}: ${reading.co} ppm`);
        }
        if (reading.voc_index > 250) {
            await createAlert('CHEMICAL_CORRIDOR', 'warning',
                `High VOC levels detected at ${nodeId}: ${reading.voc_index} ppb`);
        }
        if (lastReading && (reading.o3 - (lastReading.O3 || lastReading.o3 || 0)) > 15) {
            await createAlert('RAPID_OZONE_SPIKE', 'warning',
                `Surface ozone rising rapidly at ${nodeId} (+${(reading.o3 - (lastReading.O3 || lastReading.o3 || 0)).toFixed(1)} ppb)`);
        }
    }
}

module.exports = new SimulationService();
