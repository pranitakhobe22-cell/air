/** Color indicator functions for weather metrics */

export function getTemperatureColor(t) {
  if (t < 10) return '#3b82f6';
  if (t < 25) return '#22c55e';
  if (t < 35) return '#f97316';
  return '#ef4444';
}

export function getHumidityColor(h) {
  if (h < 30) return '#f97316';
  if (h <= 60) return '#06b6d4';
  return '#3b82f6';
}

export function getPressureColor(p) {
  if (p < 1000) return '#ef4444';
  if (p <= 1020) return '#22c55e';
  return '#3b82f6';
}

export function getWindColor(s) {
  if (s < 5) return '#22c55e';
  if (s < 20) return '#06b6d4';
  if (s < 40) return '#f97316';
  return '#ef4444';
}

export function getUVColor(uv) {
  if (uv == null) return '#9FB8C3';
  if (uv <= 2) return '#22c55e';
  if (uv <= 5) return '#eab308';
  if (uv <= 7) return '#f97316';
  if (uv <= 10) return '#ef4444';
  return '#a855f7';
}

export function getVisibilityColor(v) {
  if (v < 1) return '#ef4444';
  if (v < 5) return '#f97316';
  if (v < 10) return '#eab308';
  return '#22c55e';
}

export function getRainfallColor(r) {
  if (r === 0) return '#22c55e';
  if (r <= 10) return '#06b6d4';
  return '#3b82f6';
}

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export function degToCompass(deg) {
  return COMPASS[Math.round((deg % 360) / 22.5) % 16];
}

export function getOWMIconUrl(code) {
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
