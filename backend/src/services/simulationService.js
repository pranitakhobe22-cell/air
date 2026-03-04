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
            pm25: 12,
            pm10: 22,
            co: 0.4,
            nox: 15,
            o3: 28,
            voc_index: 45,
            temperature: 24,
            humidity: 45,
            oxygen: 20.9,
            pressure: 1013
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
            const nodes = SensorNode.findAll();
            
            for (const node of nodes) {
                if (node.status === 'offline') continue;

                // 1. Get last reading as base or use defaults
                const lastReading = Reading.findLatestByNode(node.id) || this.baseValues;
                
                // 2. Generate jittered values (+/- 5% variation)
                const jitter = (val, maxChange = 0.05) => val * (1 + (Math.random() * maxChange * 2 - maxChange));
                
                let pm25 = jitter(lastReading.pm25 || this.baseValues.pm25);
                let pm10 = jitter(lastReading.pm10 || this.baseValues.pm10);
                let co = jitter(lastReading.co || this.baseValues.co);
                let nox = jitter(lastReading.nox || this.baseValues.nox);
                let o3 = jitter(lastReading.o3 || this.baseValues.o3);
                let voc_index = jitter(lastReading.voc_index || this.baseValues.voc_index);
                
                // 3. Occasionally trigger a PM2.5 Spike (10% chance)
                if (Math.random() > 0.9) {
                    pm25 += 100 + Math.random() * 50;
                    console.log(`⚠️  [Simulation] ANOMALY DETECTED: PM2.5 Spike on ${node.id}`);
                }

                // 4. Persistence with Risk Intelligence
                const rawTelemetry = {
                    node_id: node.id,
                    pm25: parseFloat(pm25.toFixed(2)),
                    pm10: parseFloat(pm10.toFixed(2)),
                    co: parseFloat(co.toFixed(2)),
                    nox: parseFloat(nox.toFixed(2)),
                    o3: parseFloat(o3.toFixed(2)),
                    voc_index: parseFloat(voc_index.toFixed(2)),
                    temperature: parseFloat(jitter(lastReading.temperature || this.baseValues.temperature, 0.01).toFixed(1)),
                    humidity: parseFloat(jitter(lastReading.humidity || this.baseValues.humidity, 0.02).toFixed(1)),
                    oxygen: 20.9,
                    pressure: 1013
                };

                // Add Calculated Intelligence
                const intelligence = riskEngine.processReadingIntelligence(rawTelemetry);

                const finalReading = {
                    ...rawTelemetry,
                    ...intelligence
                };

                Reading.create(finalReading);
                
                // 5. Threshold Validation -> Alert Generation
                this.validateThresholds(node.id, finalReading, lastReading);
                
                // Update node sync status
                SensorNode.updateStatus(node.id, 'online');
            }
        } catch (err) {
            console.error(`❌ [Simulation] Tick error: ${err.message}`);
        }
    }

    validateThresholds(nodeId, reading, lastReading) {
        const createAlert = (type, severity, message) => {
            Alert.create({ type, severity, message });
            console.log(`🚨 [Alert] ${severity.toUpperCase()}: ${message}`);
        };

        if (reading.pm25 > 100) {
            createAlert('SEVERE_POLLUTION', 'critical', `Critical PM2.5 levels detected at ${nodeId}: ${reading.pm25} µg/m³`);
        }
        
        if (reading.co > 35) {
            createAlert('TOXIC_GAS', 'critical', `Hazardous CO levels at ${nodeId}: ${reading.co} ppm`);
        }

        if (reading.voc > 250) {
            createAlert('CHEMICAL_CORRIDOR', 'warning', `High VOC levels detected at ${nodeId}: ${reading.voc} ppb`);
        }

        // Ozone Trend Check
        if (lastReading && (reading.o3 - lastReading.o3) > 15) {
            createAlert('RAPID_OZONE_SPIKE', 'warning', `Surface ozone rising rapidly at ${nodeId} (+${(reading.o3 - lastReading.o3).toFixed(1)} ppb)`);
        }
    }
}

module.exports = new SimulationService();
