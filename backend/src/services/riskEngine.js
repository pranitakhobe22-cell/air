/**
 * AERIS – Risk Calculation Intelligence
 * ────────────────────────────────────────────────────────────────
 * Core logic for environmental health metrics.
 * 1. AQI (PM2.5 based EPA standard)
 * 2. RRI (Respiratory Risk Index - weighted telemetry)
 */

class RiskEngine {
    constructor() {
        // PM2.5 AQI Breakpoints (EPA Standard)
        this.aqiBreakpoints = [
            { cLow: 0.0,   cHigh: 12.0,  iLow: 0,   iHigh: 50,  label: 'Good' },
            { cLow: 12.1,  cHigh: 35.4,  iLow: 51,  iHigh: 100, label: 'Moderate' },
            { cLow: 35.5,  cHigh: 55.4,  iLow: 101, iHigh: 150, label: 'Unhealthy for Sensitive Groups' },
            { cLow: 55.5,  cHigh: 150.4, iLow: 151, iHigh: 200, label: 'Unhealthy' },
            { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300, label: 'Very Unhealthy' },
            { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500, label: 'Hazardous' }
        ];

        // RRI Levels
        this.rriLevels = [
            { threshold: 25, label: 'Safe',     color: '#2ECCB0' },
            { threshold: 50, label: 'Moderate', color: '#F7B731' },
            { threshold: 75, label: 'High',     color: '#EB3B5A' },
            { threshold: 100, label: 'Critical', color: '#A55EEA' }
        ];
    }

    /**
     * Calculates AQI based on PM2.5 concentration.
     * @param {number} pm25 - PM2.5 concentration in µg/m³
     * @returns {Object} { aqi, category }
     */
    calculateAQI(pm25) {
        const val = parseFloat(pm25);
        if (isNaN(val) || val < 0) return { aqi: 0, aqi_category: 'N/A' };

        const bp = this.aqiBreakpoints.find(b => val >= b.cLow && val <= b.cHigh) 
               || this.aqiBreakpoints[this.aqiBreakpoints.length - 1];

        const aqi = Math.round(
            ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (val - bp.cLow) + bp.iLow
        );

        return {
            aqi: Math.min(500, aqi),
            aqi_category: bp.label
        };
    }

    /**
     * Calculates RRI (Respiratory Risk Index) using weighted formula.
     * Formula: 40% PM2.5, 20% CO, 20% O3, 20% VOC
     * Normalization: Assumes reasonable max values for each (PM2.5: 200, CO: 50, O3: 150, VOC: 400)
     * @param {Object} reading - { pm25, co, o3, voc }
     * @returns {Object} { rri, level }
     */
    calculateRRI(reading) {
        const weights = { pm25: 0.4, co: 0.2, o3: 0.2, voc_index: 0.2 };
        
        // Normalization factors (conservative estimates for 0-100 scaling)
        const normalize = (val, max) => Math.min(100, (val / max) * 100);

        const pm25Score = normalize(reading.pm25 || 0, 150);
        const coScore = normalize(reading.co || 0, 35);
        const o3Score = normalize(reading.o3 || 0, 120);
        const vocScore = normalize(reading.voc_index || 0, 250);

        const rriValue = Math.round(
            (pm25Score * weights.pm25) +
            (coScore * weights.co) +
            (o3Score * weights.o3) +
            (vocScore * weights.voc_index)
        );

        const level = this.rriLevels.find(l => rriValue <= l.threshold) 
                    || this.rriLevels[this.rriLevels.length - 1];

        return {
            rri: Math.min(100, rriValue),
            risk_level: level.label
        };
    }

    /**
     * Helper to get Air Quality Text
     */
    getAirQualityText(aqi) {
        if (aqi <= 50) return 'Air quality is satisfactory and poses little or no risk.';
        if (aqi <= 100) return 'Air quality is acceptable; some pollutants may be a moderate concern.';
        if (aqi <= 150) return 'Sensitive groups may experience health effects.';
        if (aqi <= 200) return 'Everyone may begin to experience health effects.';
        if (aqi <= 300) return 'Health alert: everyone may experience serious health effects.';
        return 'Health warning of emergency conditions.';
    }

    /**
     * Helper to get Risk Color
     */
    getRiskColor(rri) {
        const level = this.rriLevels.find(l => rri <= l.threshold) 
                    || this.rriLevels[this.rriLevels.length - 1];
        return level.color;
    }

    /**
     * Determine dominant pollutant
     */
    getDominant(sensors) {
        const ratios = {
            'PM2.5': (sensors.pm25 || 0) / 35,
            'CO':    (sensors.co || 0) / 4,
            'O₃':   (sensors.o3 || 0) / 54,
            'VOC':   (sensors.voc_index || 0) / 100,
        };
        return Object.entries(ratios).sort((a, b) => b[1] - a[1])[0][0];
    }

    /**
     * Aggregates intelligence metrics for a reading.
     */
    processReadingIntelligence(reading) {
        const aqiData = this.calculateAQI(reading.pm25);
        const rriData = this.calculateRRI(reading);

        return {
            ...aqiData,
            air_quality_text: this.getAirQualityText(aqiData.aqi),
            ...rriData,
            risk_color: this.getRiskColor(rriData.rri),
            dominant: this.getDominant(reading)
        };
    }
}

module.exports = new RiskEngine();
