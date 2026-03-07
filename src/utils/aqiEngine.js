/**
 * AERIS – AQI Precision Engine
 * ─────────────────────────────────────────────────────────────────────
 * EPA-standard sub-AQI calculation, dominant pollutant detection,
 * EWMA-based forecast model, non-linear dose-response, and
 * multi-factor health advisory generation.
 */

// ── EPA Sub-AQI Breakpoints ───────────────────────────────────────
// Source: US EPA AQI Technical Assistance Document (EPA-454/B-18-007)
const BREAKPOINTS = {
  pm25: [
    { cLow: 0,     cHigh: 12,    iLow: 0,   iHigh: 50 },
    { cLow: 12.1,  cHigh: 35.4,  iLow: 51,  iHigh: 100 },
    { cLow: 35.5,  cHigh: 55.4,  iLow: 101, iHigh: 150 },
    { cLow: 55.5,  cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
  ],
  pm10: [
    { cLow: 0,   cHigh: 54,  iLow: 0,   iHigh: 50 },
    { cLow: 55,  cHigh: 154, iLow: 51,  iHigh: 100 },
    { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
    { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
    { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
    { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
  ],
  co: [
    { cLow: 0,    cHigh: 4.4,  iLow: 0,   iHigh: 50 },
    { cLow: 4.5,  cHigh: 9.4,  iLow: 51,  iHigh: 100 },
    { cLow: 9.5,  cHigh: 12.4, iLow: 101, iHigh: 150 },
    { cLow: 12.5, cHigh: 15.4, iLow: 151, iHigh: 200 },
    { cLow: 15.5, cHigh: 30.4, iLow: 201, iHigh: 300 },
    { cLow: 30.5, cHigh: 50.4, iLow: 301, iHigh: 500 },
  ],
  o3: [
    { cLow: 0,     cHigh: 54,  iLow: 0,   iHigh: 50 },
    { cLow: 55,    cHigh: 70,  iLow: 51,  iHigh: 100 },
    { cLow: 71,    cHigh: 85,  iLow: 101, iHigh: 150 },
    { cLow: 86,    cHigh: 105, iLow: 151, iHigh: 200 },
    { cLow: 106,   cHigh: 200, iLow: 201, iHigh: 300 },
  ],
  no2: [
    { cLow: 0,   cHigh: 53,   iLow: 0,   iHigh: 50 },
    { cLow: 54,  cHigh: 100,  iLow: 51,  iHigh: 100 },
    { cLow: 101, cHigh: 360,  iLow: 101, iHigh: 150 },
    { cLow: 361, cHigh: 649,  iLow: 151, iHigh: 200 },
    { cLow: 650, cHigh: 1249, iLow: 201, iHigh: 300 },
    { cLow: 1250, cHigh: 2049, iLow: 301, iHigh: 500 },
  ],
};

/**
 * Calculate sub-AQI for a single pollutant using EPA linear interpolation.
 * Formula: I = ((iHigh - iLow) / (cHigh - cLow)) * (C - cLow) + iLow
 */
export function calcSubAqi(pollutant, concentration) {
  const bps = BREAKPOINTS[pollutant];
  if (!bps || concentration == null || isNaN(concentration)) return 0;

  const c = Math.max(0, concentration);

  for (const bp of bps) {
    if (c >= bp.cLow && c <= bp.cHigh) {
      return Math.round(
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (c - bp.cLow) + bp.iLow
      );
    }
  }

  // Beyond highest breakpoint — cap at 500
  return 500;
}

/**
 * Compute overall AQI and identify dominant pollutant.
 * Returns { aqi, dominant, subAqis: { pm25, pm10, co, o3, no2 } }
 */
export function computeAqi(sensors) {
  if (!sensors) return { aqi: 0, dominant: 'PM2.5', subAqis: {} };

  const subAqis = {
    pm25: calcSubAqi('pm25', sensors.pm25),
    pm10: calcSubAqi('pm10', sensors.pm10),
    co: calcSubAqi('co', sensors.co),
    o3: calcSubAqi('o3', sensors.o3),
    no2: calcSubAqi('no2', sensors.nox || sensors.no2 || 0),
  };

  const labels = { pm25: 'PM2.5', pm10: 'PM10', co: 'CO', o3: 'O₃', no2: 'NO₂' };
  let maxKey = 'pm25';
  let maxVal = 0;

  for (const [key, val] of Object.entries(subAqis)) {
    if (val > maxVal) {
      maxVal = val;
      maxKey = key;
    }
  }

  return {
    aqi: maxVal,
    dominant: labels[maxKey],
    subAqis,
  };
}

// ── EWMA Forecast Model ──────────────────────────────────────────
/**
 * Exponentially Weighted Moving Average (EWMA) forecast.
 * Uses trend-adjusted exponential smoothing (Holt's method) to predict
 * the next N hours of AQI based on historical readings.
 *
 * @param {Array} history - Array of { timestamp, aqi } objects
 * @param {number} hoursAhead - How many hours to forecast (default 6)
 * @returns {Array} - Forecast points { timestamp, aqi, confidence }
 */
export function forecastAqi(history, hoursAhead = 6) {
  if (!Array.isArray(history) || history.length < 3) return [];

  // Extract AQI values (last 60 max)
  const values = history.slice(-60).map((h) => h.aqi || 0);
  const n = values.length;

  // Holt's linear exponential smoothing
  const alpha = 0.35; // Level smoothing factor
  const beta = 0.15;  // Trend smoothing factor

  let level = values[0];
  let trend = (values[Math.min(3, n - 1)] - values[0]) / Math.min(3, n - 1);

  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // Calculate residual variance for confidence intervals
  let sumSquaredError = 0;
  let tempLevel = values[0];
  let tempTrend = trend;
  for (let i = 1; i < n; i++) {
    const forecast = tempLevel + tempTrend;
    sumSquaredError += (values[i] - forecast) ** 2;
    const prevLevel = tempLevel;
    tempLevel = alpha * values[i] + (1 - alpha) * (prevLevel + tempTrend);
    tempTrend = beta * (tempLevel - prevLevel) + (1 - beta) * tempTrend;
  }
  const rmse = Math.sqrt(sumSquaredError / Math.max(1, n - 1));

  // Generate forecast points
  const lastTs = history[history.length - 1]?.timestamp || Date.now();
  const baseTime = typeof lastTs === 'string' ? new Date(lastTs).getTime() : lastTs;
  const points = [];

  for (let h = 1; h <= hoursAhead; h++) {
    const forecastValue = Math.max(0, Math.min(500, Math.round(level + trend * h)));
    // Confidence decreases with forecast horizon
    const confidence = Math.max(50, Math.round(95 - (rmse / Math.max(1, level)) * 100 * Math.sqrt(h) * 0.5));

    points.push({
      timestamp: new Date(baseTime + h * 3600000).toISOString(),
      aqi: forecastValue,
      confidence: Math.min(98, Math.max(50, confidence)),
    });
  }

  return points;
}

// ── Non-Linear Dose-Response Model ────────────────────────────────
/**
 * Calculate health impact using a sigmoid dose-response curve.
 * Based on the Hill equation adapted for air quality exposure:
 *   Response = Rmax * (C^n / (EC50^n + C^n))
 *
 * @param {number} pm25 - PM2.5 concentration (µg/m³)
 * @param {number} duration - Exposure hours
 * @param {number} modifier - Demographic vulnerability multiplier
 * @returns {{ risk, inhaledMass, stressScore, advisory, breathingRate }}
 */
export function doseResponse(pm25, duration, modifier = 1.0) {
  // Breathing rate adjusts with activity (m³/hr)
  const breathingRate = 0.48; // Resting adult
  const inhaledVolume = breathingRate * duration; // m³
  const inhaledMass = inhaledVolume * pm25; // µg total inhaled PM2.5

  // Sigmoid dose-response (Hill equation)
  // EC50 = concentration at 50% maximum response
  const EC50 = 55; // µg/m³ (WHO "Unhealthy for Sensitive Groups" threshold)
  const hillCoeff = 2.2; // Cooperativity coefficient
  const Rmax = 100; // Maximum risk score

  const response = Rmax * (pm25 ** hillCoeff) / (EC50 ** hillCoeff + pm25 ** hillCoeff);

  // Duration scaling (logarithmic — first hours matter most)
  const durationFactor = 1 + 0.3 * Math.log2(Math.max(1, duration));

  // Final risk score
  const risk = Math.min(100, Math.round(response * durationFactor * modifier));

  // Cumulative stress score (area under curve approximation)
  const stressScore = Math.round(risk * Math.sqrt(duration) * 2.5);

  // Dynamic advisory based on computed risk
  let advisory;
  if (risk >= 80) {
    advisory = 'Critical exposure level. Evacuate to filtered indoor environment immediately. Seek medical attention if experiencing symptoms.';
  } else if (risk >= 60) {
    advisory = 'High exposure risk. Limit all outdoor activity. Use N95 respirator if outdoors is unavoidable. Monitor for respiratory symptoms.';
  } else if (risk >= 40) {
    advisory = 'Moderate exposure. Reduce prolonged outdoor exertion. Sensitive groups should remain indoors with air filtration.';
  } else if (risk >= 20) {
    advisory = 'Low-moderate exposure. General population can continue normal activity. Sensitive individuals should limit vigorous outdoor exercise.';
  } else {
    advisory = 'Minimal physiological impact. Normal outdoor activities are safe for all groups.';
  }

  return {
    risk,
    inhaledMass: Math.round(inhaledMass * 10) / 10,
    stressScore,
    advisory,
    breathingRate,
  };
}

// ── Multi-Factor Smart Health Advisory ────────────────────────────
/**
 * Generate dynamic, context-aware health recommendations.
 * Factors: AQI, dominant pollutant, temperature, humidity, user demographics.
 */
export function generateAdvisory(sensors, environment, derived, groupId = 'adult') {
  const aqi = derived?.aqi || 0;
  const rri = derived?.rri || 0;
  const pm25 = sensors?.pm25 || 0;
  const co = sensors?.co || 0;
  const o3 = sensors?.o3 || 0;
  const temp = environment?.temperature || 25;
  const humidity = environment?.humidity || 50;

  const recommendations = [];
  const warnings = [];

  // Temperature-specific advice
  if (temp > 35) {
    recommendations.push('Extreme heat detected. Increase fluid intake by 50%. Avoid midday outdoor exposure.');
    warnings.push('Heat amplifies pollutant effects on the respiratory system.');
  } else if (temp > 30) {
    recommendations.push('High temperature increases ozone formation. Limit outdoor activity between 11AM-4PM.');
  }

  if (humidity > 80) {
    recommendations.push('High humidity traps pollutants near ground level. Stay in air-conditioned spaces.');
  } else if (humidity < 20) {
    recommendations.push('Very dry air irritates airways. Use a humidifier indoors and stay hydrated.');
  }

  // Pollutant-specific advice
  if (pm25 > 55) {
    recommendations.push('PM2.5 at unhealthy levels. N95/KN95 mask required outdoors. Run HEPA air purifier indoors.');
    warnings.push('Fine particles bypass respiratory defenses and enter the bloodstream.');
  } else if (pm25 > 35) {
    recommendations.push('PM2.5 elevated. Consider wearing a mask for extended outdoor exposure.');
  }

  if (co > 9) {
    recommendations.push('CO levels dangerous. Ensure proper ventilation. Check for nearby combustion sources.');
    warnings.push('Carbon monoxide displaces oxygen in blood. Symptoms: headache, dizziness, nausea.');
  } else if (co > 4.4) {
    recommendations.push('CO moderately elevated. Avoid enclosed spaces near traffic or generators.');
  }

  if (o3 > 70) {
    recommendations.push('Ground-level ozone elevated. Avoid strenuous outdoor exercise, especially in afternoon.');
    warnings.push('Ozone chemically damages lung tissue and reduces pulmonary function.');
  }

  // Group-specific advice
  const groupAdvice = {
    asthma: {
      recs: ['Keep rescue inhaler accessible at all times.', 'Pre-medicate before any outdoor activity.', 'Monitor peak flow readings twice daily.'],
      threshold: 40,
    },
    children: {
      recs: ['Limit outdoor play to early morning hours.', 'Ensure school HVAC systems have adequate filtration.', 'Watch for coughing, wheezing, or shortness of breath.'],
      threshold: 50,
    },
    elderly: {
      recs: ['Avoid outdoor walks during peak pollution hours.', 'Keep medications readily available.', 'Monitor blood pressure — air pollution can cause spikes.'],
      threshold: 45,
    },
    heart: {
      recs: ['Air pollution triggers cardiovascular events. Minimize all exertion.', 'Monitor heart rate and blood pressure regularly.', 'Take prescribed cardiac medications as scheduled.'],
      threshold: 45,
    },
    smokers: {
      recs: ['Pollution compounds smoking damage exponentially.', 'Consider temporary cessation during high AQI periods.', 'Increase antioxidant intake (Vitamin C, E).'],
      threshold: 60,
    },
    adult: {
      recs: ['Maintain normal routine with awareness of air quality.', 'Stay hydrated — water helps clear inhaled particles.'],
      threshold: 70,
    },
  };

  const group = groupAdvice[groupId] || groupAdvice.adult;
  if (rri >= group.threshold) {
    recommendations.push(...group.recs);
  }

  // Hydration recommendation
  const hydrationMultiplier = temp > 35 ? 1.6 : temp > 30 ? 1.35 : temp > 25 ? 1.15 : 1.0;
  const baseHydrationMl = 2500; // ml/day baseline
  const hydrationMl = Math.round(baseHydrationMl * hydrationMultiplier);
  const hydrationOz = Math.round(hydrationMl / 29.57);

  // Outdoor limit
  let outdoorLimit;
  if (rri >= 80) outdoorLimit = 'Avoid outdoors entirely';
  else if (rri >= 60) outdoorLimit = '30 min maximum with mask';
  else if (rri >= 40) outdoorLimit = '2-3 hours with breaks';
  else if (rri >= 20) outdoorLimit = '4-6 hours normal activity';
  else outdoorLimit = 'Unlimited — air quality is safe';

  // Mask recommendation
  let maskType;
  if (pm25 > 150 || aqi > 200) maskType = 'N95/KN95 required';
  else if (pm25 > 55 || aqi > 150) maskType = 'N95 recommended';
  else if (pm25 > 35 || aqi > 100) maskType = 'Surgical mask suggested';
  else maskType = 'Not needed';

  return {
    recommendations: recommendations.slice(0, 6),
    warnings,
    hydrationOz,
    hydrationMl,
    outdoorLimit,
    maskType,
    isDanger: rri >= (group.threshold || 50),
    groupThreshold: group.threshold,
  };
}

// ── Trend Detection ──────────────────────────────────────────────
/**
 * Detect whether AQI is trending up, down, or stable.
 * Uses linear regression over recent readings.
 */
export function detectTrend(history) {
  if (!Array.isArray(history) || history.length < 3) return 'stable';

  const recent = history.slice(-10).map((h) => h.aqi || 0);
  const n = recent.length;
  const xMean = (n - 1) / 2;
  const yMean = recent.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (recent[i] - yMean);
    den += (i - xMean) ** 2;
  }

  const slope = den === 0 ? 0 : num / den;
  const threshold = yMean * 0.02; // 2% of mean as significance threshold

  if (slope > threshold) return 'rising';
  if (slope < -threshold) return 'falling';
  return 'stable';
}
