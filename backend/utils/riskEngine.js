/**
 * AERIS Backend — Risk Computation Engine
 * ────────────────────────────────────────────────────────────────
 * Utility to calculate AQI (Air Quality Index) and 
 * RRI (Relative Risk Index) from raw sensor telemetry.
 * 
 * Reusability Note: 
 * This precise logic mirrors the frontend `aerisStore.js` to ensure 
 * 100% parity between local simulator calculations and backend processing.
 * By unifying the algorithm here, the backend becomes the single source 
 * of truth for historical/stored data, while the frontend handles live 
 * optimistic updates seamlessly using the identical mathematical model.
 */

// ── EPA Breakpoints for PM2.5 to AQI ────────────────────────────
const AQI_BREAKPOINTS = [
  { cLow: 0,    cHigh: 12,    iLow: 0,   iHigh: 50 },
  { cLow: 12.1, cHigh: 35.4,  iLow: 51,  iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4,  iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
  { cLow: 150.5,cHigh: 250.4, iLow: 201, iHigh: 300 },
  { cLow: 250.5,cHigh: 500.4, iLow: 301, iHigh: 500 },
];

const RISK_CATEGORIES = [
  { max: 35, label: 'Safe' },
  { max: 55, label: 'Moderate' },
  { max: 75, label: 'Elevated' },
  { max: 100, label: 'Danger' }
];

// ── Helper: Compute AQI ─────────────────────────────────────────
function computeAQI(pm25) {
  const val = Math.max(0, pm25);
  for (const b of AQI_BREAKPOINTS) {
    if (val >= b.cLow && val <= b.cHigh) {
      return Math.round(((b.iHigh - b.iLow) / (b.cHigh - b.cLow)) * (val - b.cLow) + b.iLow);
    }
  }
  return 500; // Max hazardous bound if over 500
}

function getAQICategory(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// ── Main Engine ─────────────────────────────────────────────────
/**
 * Computes AQI and RRI based on raw telemetry payload.
 * RRI Weighting (per instruction):
 * PM2.5 : 40%
 * CO    : 20%
 * Ozone : 20%
 * VOC   : 20%
 */
const calculateRiskMetrics = (sensors) => {
  // 1. Calculate Standard AQI (Driven primarily by PM2.5 in this context)
  const aqi = computeAQI(sensors.pm25);
  const aqiCategory = getAQICategory(aqi);

  // 2. Base RRI derivation from raw pollutants
  let rriBase = 0;
  
  // Weights (normalized to an arbitrary max penalty scale for 100 max boundary)
  // These mapping scalars represent the penalty severity applied by each pollutant.
  
  // 40% Weight - PM2.5 directly scales from AQI
  rriBase += (aqi * 0.40);

  // 20% Weight - CO (Assuming normal bounds < 4ppm, severe > 10ppm)
  const coPenalty = sensors.co > 4 ? (sensors.co - 4) * 3 : 0;
  rriBase += coPenalty * 0.20;

  // 20% Weight - Ozone (Assuming normal bounds < 54ppb, severe > 100ppb)
  const o3Penalty = sensors.o3 > 54 ? (sensors.o3 - 54) * 0.3 : 0;
  rriBase += o3Penalty * 0.20;

  // 20% Weight - VOC (Assuming Index normal < 100, severe > 300)
  const vocPenalty = sensors.vocIndex > 100 ? (sensors.vocIndex - 100) * 0.1 : 0;
  rriBase += vocPenalty * 0.20;

  // Normalize final RRI
  let rri = Math.round(rriBase);
  rri = Math.max(0, Math.min(100, rri)); // Cap strictly between 0 and 100

  // Determine Category
  const riskCategory = RISK_CATEGORIES.find(c => rri <= c.max)?.label || 'Danger';

  return {
    aqi,
    aqiCategory,
    rri,
    riskLevel: riskCategory
  };
};

module.exports = {
  computeAQI,
  getAQICategory,
  calculateRiskMetrics
};

