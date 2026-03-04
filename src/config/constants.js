/**
 * AERIS – Application Constants
 * Central registry for thresholds, breakpoints, and configuration.
 */

export const APP_NAME = 'AERIS';
export const APP_TAGLINE = 'Environmental Risk Intelligence';

// ── AQI Breakpoints (EPA Standard) ──────────────────────────────
export const AQI_BREAKPOINTS = [
  { min: 0,   max: 50,  label: 'Good',                   key: 'good',       color: '#2ECCB0' },
  { min: 51,  max: 100, label: 'Moderate',                key: 'moderate',   color: '#F4A261' },
  { min: 101, max: 150, label: 'Unhealthy for Sensitive', key: 'sensitive',  color: '#E67E22' },
  { min: 151, max: 200, label: 'Unhealthy',               key: 'unhealthy',  color: '#E63946' },
  { min: 201, max: 300, label: 'Very Unhealthy',          key: 'very_unhealthy', color: '#9B59B6' },
  { min: 301, max: 500, label: 'Hazardous',               key: 'hazardous',  color: '#7D1128' },
];

// ── RRI Risk Thresholds ─────────────────────────────────────────
export const RISK_THRESHOLDS = {
  SAFE:     { min: 0,  max: 34,  label: 'Safe',     key: 'safe',     color: '#2ECCB0' },
  MODERATE: { min: 35, max: 54,  label: 'Moderate',  key: 'moderate', color: '#F4A261' },
  ELEVATED: { min: 55, max: 74,  label: 'Elevated',  key: 'elevated', color: '#E67E22' },
  HIGH:     { min: 75, max: 89,  label: 'High',      key: 'high',     color: '#E63946' },
  SEVERE:   { min: 90, max: 100, label: 'Severe',    key: 'severe',   color: '#9B59B6' },
};

// ── Risk Colors ─────────────────────────────────────────────────
export const RISK_COLORS = {
  safe:     '#2ECCB0',
  moderate: '#F4A261',
  elevated: '#E67E22',
  high:     '#E63946',
  severe:   '#9B59B6',
};

// ── Sensor Config ───────────────────────────────────────────────
export const SENSOR_CONFIG = {
  pm25:       { label: 'PM2.5',       unit: 'µg/m³',  icon: 'cloud',       min: 0,   max: 500,  safe: 35 },
  co:         { label: 'CO',          unit: 'ppm',     icon: 'wind',        min: 0,   max: 50,   safe: 4.0 },
  o3:         { label: 'Ozone',       unit: 'ppb',     icon: 'sun',         min: 0,   max: 300,  safe: 54 },
  voc_index:  { label: 'VOC',         unit: 'Index',   icon: 'flask-round', min: 0,   max: 500,  safe: 100 },
  temperature:{ label: 'Temperature', unit: '°C',      icon: 'thermometer', min: -10, max: 55,   safe: 35 },
  humidity:   { label: 'Humidity',    unit: '%',        icon: 'droplets',    min: 0,   max: 100,  safe: 70 },
};

// ── Pollutant IDs ───────────────────────────────────────────────
export const POLLUTANT_IDS = {
  PM25:     'pm25',
  CO:       'co',
  O3:       'o3',
  VOC:      'voc_index',
  TEMP:     'temperature',
  HUMIDITY: 'humidity',
};

// ── Storage Keys ────────────────────────────────────────────────
export const STORAGE_KEYS = {
  AUTH_TOKEN:     'aeris_auth_token',
  HEALTH_PROFILE: 'aeris_health_profile',
  APP_STATE:      'aeris_app_state',
  THEME:          'aeris_theme',
};

// ── Simulation Config ───────────────────────────────────────────
export const SIMULATION = {
  INTERVAL_MS: 7000,       // 7 seconds between updates
  HISTORY_LENGTH: 24,      // Keep 24 data points
  SPIKE_PROBABILITY: 0.05, // 5% chance of spike event
};
