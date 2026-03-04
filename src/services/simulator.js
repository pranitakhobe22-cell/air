/**
 * AERIS – Sensor Simulator
 * ────────────────────────────────────────────────────────────────
 * Generates realistic sensor data using smooth random walks.
 * Falls back to this when no backend API is available.
 *
 * Features:
 * - Smooth random walks within realistic bounds
 * - Time-of-day influence (rush hour pollution)
 * - Occasional spike events that trigger alerts
 */
import { SIMULATION } from '@/config/constants';

// ── State ───────────────────────────────────────────────────────
let current = {
  pm25: 12,
  pm10: 22,
  co: 0.4,
  nox: 15,
  o3: 28,
  voc_index: 45,
  temperature: 28,
  humidity: 55,
  oxygen: 20.9,
  pressure: 1013,
};

// ── Random walk helper ──────────────────────────────────────────
function drift(value, step, min, max) {
  const delta = (Math.random() - 0.5) * 2 * step;
  return Math.max(min, Math.min(max, value + delta));
}

// ── Time-of-day multiplier ──────────────────────────────────────
function getTimeFactor() {
  const hour = new Date().getHours();
  // Rush hours: 7-10 AM and 5-8 PM → higher pollution
  if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20)) return 1.4;
  // Night: cleaner air
  if (hour >= 23 || hour <= 5) return 0.7;
  return 1.0;
}

// ── Generate next tick ──────────────────────────────────────────
export function generateTick() {
  const factor = getTimeFactor();
  const isSpike = Math.random() < SIMULATION.SPIKE_PROBABILITY;

  current = {
    pm25:        isSpike ? drift(current.pm25 * 3, 20, 50, 350) : drift(current.pm25, 3 * factor, 3, 180),
    pm10:        isSpike ? drift(current.pm10 * 2.5, 30, 80, 500) : drift(current.pm10, 5 * factor, 5, 250),
    co:          isSpike ? drift(current.co * 2.5, 1, 2, 15)     : drift(current.co, 0.2 * factor, 0.1, 9),
    nox:         drift(current.nox, 2 * factor, 5, 150),
    o3:          drift(current.o3, 4 * factor, 5, 200),
    voc_index:   drift(current.voc_index, 8 * factor, 10, 400),
    temperature: drift(current.temperature, 0.3, 15, 45),
    humidity:    drift(current.humidity, 1.5, 20, 95),
    oxygen:      drift(current.oxygen, 0.05, 19.5, 21.5),
    pressure:    drift(current.pressure, 0.5, 990, 1040),
  };

  // Round for display
  const rounded = {
    pm25:        Math.round(current.pm25 * 10) / 10,
    pm10:        Math.round(current.pm10),
    co:          Math.round(current.co * 100) / 100,
    nox:         Math.round(current.nox),
    o3:          Math.round(current.o3 * 10) / 10,
    voc_index:   Math.round(current.voc_index),
    temperature: Math.round(current.temperature * 10) / 10,
    humidity:    Math.round(current.humidity * 10) / 10,
    oxygen:      Math.round(current.oxygen * 10) / 10,
    pressure:    Math.round(current.pressure * 10) / 10,
  };

  // Generate alert if spike
  const alert = isSpike
    ? {
        id: `alert-${Date.now()}`,
        type: 'critical',
        message: `⚠️ Sudden PM2.5 spike detected: ${rounded.pm25} µg/m³ — Take protective measures`,
        timestamp: new Date().toISOString(),
        source: 'spike-detector',
      }
    : null;

  return { sensors: rounded, alert };
}

// ── Generate sector data ────────────────────────────────────────
export function generateSectorUpdate(sectors) {
  return sectors.map((sector) => ({
    ...sector,
    aqi: Math.max(10, Math.min(300, sector.aqi + Math.floor((Math.random() - 0.5) * 10))),
    rri: Math.max(5, Math.min(95, sector.rri + Math.floor((Math.random() - 0.5) * 8))),
  }));
}

// ── Generate node status updates ────────────────────────────────
export function generateNodeUpdate(nodes) {
  return nodes.map((node) => ({
    ...node,
    battery: Math.max(5, Math.min(100, node.battery + (Math.random() > 0.7 ? -1 : 0))),
    lastPing: node.status === 'active' ? new Date().toISOString() : node.lastPing,
  }));
}

export default { generateTick, generateSectorUpdate, generateNodeUpdate };
