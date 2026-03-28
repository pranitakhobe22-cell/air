import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Clock, MapPin, RefreshCw, Wind, Thermometer, Droplets, Heart, Gauge, Sun,
  AlertTriangle, Flame, Factory, CloudRain, Leaf, ShieldAlert, X
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';
import useActiveNode from '@/hooks/useActiveNode';
import useThemeMode from '@/hooks/useThemeMode';
import useNodeStore from '@/store/useNodeStore';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/* ── Animated number ──────────────────────────────────── */
const AnimatedNum = ({ value, decimals = 0 }) => {
  const [display, setDisplay] = useState(value || 0);
  const prev = useRef(value || 0);

  useEffect(() => {
    if (value == null) return;
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    let start = null;
    let raf;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 600, 1);
      setDisplay(from + (value - from) * p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
};

/* ── Sensor color helper (EPA thresholds) ────────────── */
const sensorStatus = (id, val) => {
  const thresholds = {
    pm25: [30, 60, 90, 120],  // CPCB: Good/Satisfactory/Moderate/Poor

    co: [1.0, 2.0, 10, 17],  // CPCB mg/m³
    o3: [50, 100, 168, 208],  // CPCB µg/m³
    nox: [40, 80, 180, 280],  // CPCB µg/m³
    voc: [100, 200, 300, 400],
    uv: [3, 6, 8, 11],
    temp: [25, 32, 38, 45],
    hum: [30, 60, 80, 95],
  };
  const t = thresholds[id];
  if (!t) return 'var(--color-text-secondary)';
  if (val <= t[0]) return '#22c55e';
  if (val <= t[1]) return '#eab308';
  if (val <= t[2]) return '#f97316';
  return '#ef4444';
};

/* ── LiveStatus Page ──────────────────────────────────── */
const LiveStatus = () => {
  const data = useAerisStore((s) => s.data);
  const loading = useAerisStore((s) => s.loading);
  const active = useActiveNode();
  const isDark = useThemeMode();
  const userLocation = useNodeStore((s) => s.userLocation);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [eventLog, setEventLog] = useState([]);

  useEffect(() => {
    if (data?.sensors) setLastUpdate(new Date());
  }, [data]);

  // Build event log from alerts
  useEffect(() => {
    if (!data) return;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const events = [];

    if (data.alerts?.length > 0) {
      data.alerts.slice(0, 2).forEach((a) => {
        events.push({ time: ts, type: 'alert', message: a.message });
      });
    }

    events.push({ time: ts, type: 'sync', message: 'Sensor data received and processed.' });

    setEventLog((prev) => [...events, ...prev].slice(0, 30));
  }, [data]);

  if (!data?.sensors) {
    return (
      <div className="p-6 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-8">
        <div>
          <div className="h-7 w-40 glass-card rounded-lg animate-pulse" />
          <div className="h-4 w-64 glass-card rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 grid grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card rounded-xl h-32 animate-pulse" />
            ))}
          </div>
          <div className="lg:col-span-4 space-y-5">
            <div className="glass-card rounded-xl h-64 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const { sectors, meta } = data;
  const secondsAgo = Math.floor((new Date() - lastUpdate) / 1000);

  const activeSensors = active.sensors || data.sensors;
  const activeDerived = active.derived || data.derived;
  const activeEnv = active.environment || data.environment;

  const sensorTiles = [
    { id: 'pm25', label: 'PM2.5', value: activeSensors.pm25, unit: 'µg/m³', icon: Activity, decimals: 1, max: 150 },
   
    { id: 'o3', label: 'Ozone', value: activeSensors.o3, unit: 'ppb', icon: Wind, decimals: 1, max: 120 },
    { id: 'co', label: 'CO', value: activeSensors.co, unit: 'ppm', icon: Gauge, decimals: 2, max: 15 },
    { id: 'nox', label: 'NOx', value: activeSensors.nox, unit: 'ppb', icon: Activity, decimals: 0, max: 360 },
    { id: 'voc', label: 'VOC Index', value: activeSensors.voc_index, unit: 'index', icon: Activity, decimals: 0, max: 500 },
    { id: 'uv', label: 'UV Index', value: activeSensors.uv ?? 5.2, unit: 'idx', icon: Sun, decimals: 1, max: 14 },
    { id: 'temp', label: 'Temperature', value: activeEnv?.temperature || activeSensors.temperature, unit: '°C', icon: Thermometer, decimals: 1, max: 50 },
    { id: 'hum', label: 'Humidity', value: activeEnv?.humidity || activeSensors.humidity, unit: '%', icon: Droplets, decimals: 0, max: 100 },
  ];

  const defaultCenter = userLocation ? [userLocation.lat, userLocation.lng] : [20.5937, 78.9629];
  const mapCenter = sectors?.[0]?.lat ? [sectors[0].lat, sectors[0].lng] : defaultCenter;
  const riskColor = activeDerived?.risk_color || '#10b981';
  const tileUrl = isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  // ── Toxic Event Detection ─────────────────────────────────
  const toxicAlerts = [];
  const pm25 = activeSensors.pm25 || 0;
  const pm10Val = activeSensors.pm10 || Math.round(pm25 * 1.2);
  const coVal = activeSensors.co || 0;
  const noxVal = activeSensors.nox || 0;
  const vocVal = activeSensors.voc_index || 0;
  const o3Val = activeSensors.o3 || 0;
  const uvVal = activeSensors.uv ?? 5.2;
  const tempVal = activeEnv?.temperature || 0;
  const humVal = activeEnv?.humidity || 0;

  // Dust / Sandstorm: high PM10, PM10 >> PM2.5, low humidity
  if (pm10Val > 150 && pm10Val > pm25 * 2.5 && humVal < 35) {
    toxicAlerts.push({ id: 'dust', severity: 'danger', icon: Wind, label: 'Dust Storm', message: `PM10 at ${pm10Val} µg/m³ with low humidity (${humVal}%). Possible dust or sandstorm event detected.` });
  } else if (pm10Val > 100 && pm10Val > pm25 * 2) {
    toxicAlerts.push({ id: 'dust', severity: 'warning', icon: Wind, label: 'Elevated Dust', message: `PM10 at ${pm10Val} µg/m³ — elevated coarse particulates suggest dust activity.` });
  }

  // Fire / Smoke: high PM2.5 + high CO + elevated VOC
  if (pm25 > 100 && coVal > 9 && vocVal > 200) {
    toxicAlerts.push({ id: 'fire', severity: 'danger', icon: Flame, label: 'Fire / Smoke', message: `PM2.5 ${pm25}, CO ${coVal} ppm, VOC ${vocVal} — pattern consistent with fire or biomass burning nearby.` });
  } else if (pm25 > 55 && coVal > 4.5 && vocVal > 150) {
    toxicAlerts.push({ id: 'fire', severity: 'warning', icon: Flame, label: 'Smoke Detected', message: `Elevated PM2.5 + CO + VOC levels suggest possible smoke or burning activity.` });
  }

  // Industrial Emission: high NOx + high VOC + moderate PM2.5
  if (noxVal > 100 && vocVal > 250) {
    toxicAlerts.push({ id: 'industrial', severity: 'danger', icon: Factory, label: 'Industrial Emission', message: `NOx at ${noxVal} ppb, VOC at ${vocVal} — likely industrial or chemical emission event.` });
  } else if (noxVal > 53 && vocVal > 150) {
    toxicAlerts.push({ id: 'industrial', severity: 'warning', icon: Factory, label: 'Industrial Activity', message: `Elevated NOx (${noxVal} ppb) and VOC (${vocVal}) indicate nearby industrial emissions.` });
  }

  // Seasonal / Photochemical Smog: high O3 + high temp + high UV
  if (o3Val > 85 && tempVal > 32 && uvVal > 6) {
    toxicAlerts.push({ id: 'smog', severity: 'danger', icon: Leaf, label: 'Photochemical Smog', message: `Ozone at ${o3Val} ppb with high temp (${tempVal}°C) and UV (${uvVal}) — photochemical smog conditions.` });
  } else if (o3Val > 70 && tempVal > 28) {
    toxicAlerts.push({ id: 'smog', severity: 'warning', icon: Leaf, label: 'Seasonal Ozone', message: `Ozone rising to ${o3Val} ppb in warm conditions — typical seasonal pattern.` });
  }

  // Extreme UV
  if (uvVal >= 11) {
    toxicAlerts.push({ id: 'uv', severity: 'danger', icon: Sun, label: 'Extreme UV', message: `UV Index at ${uvVal} — extreme radiation. Avoid all outdoor exposure.` });
  } else if (uvVal >= 8) {
    toxicAlerts.push({ id: 'uv', severity: 'warning', icon: Sun, label: 'Very High UV', message: `UV Index at ${uvVal} — very high. Limit outdoor time, use sunscreen and shade.` });
  }

  // Heavy Rain Washout
  if (activeEnv?.rain && pm25 < 15) {
    toxicAlerts.push({ id: 'rain', severity: 'info', icon: CloudRain, label: 'Rain Washout', message: `Rain is clearing particulates — PM2.5 down to ${pm25} µg/m³. Air quality improving.` });
  }

  // All-clear
  if (toxicAlerts.length === 0) {
    toxicAlerts.push({ id: 'clear', severity: 'safe', icon: ShieldAlert, label: 'All Clear', message: 'No toxic events detected. Air quality is within safe parameters.' });
  }

  const eventColors = {
    alert: 'border-red-500/30 bg-red-500/5 text-red-400',
    sync: 'border-(--color-card-border) subtle-surface text-(--color-text-secondary)',
  };

  const severityConfig = {
    danger: { bg: 'bg-rose-500/10', border: 'border-rose-500/25', text: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-400', dot: 'bg-rose-500' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/25', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-500' },
    info: { bg: 'bg-sky-500/10', border: 'border-sky-500/25', text: 'text-sky-400', badge: 'bg-sky-500/20 text-sky-400', dot: 'bg-sky-500' },
    safe: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-500' },
  };

  return (
    <div className="p-6 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-8">

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-xl font-bold text-(--color-text-primary) tracking-tight">Live Status</h1>
          <p className="text-sm text-(--color-text-secondary) opacity-60 mt-0.5">
            Real-time sensor readings &middot; {active.nodeName || meta?.location || 'Local Station'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-lg">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <Clock size={14} className="text-(--color-text-secondary) opacity-60" />
            <span className="text-xs text-(--color-text-secondary) tabular-nums">{secondsAgo}s ago</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2 glass-button rounded-lg transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Rain Banner ──────────────────────────────── */}
      {activeEnv?.rain && (
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <Droplets size={18} className="text-sky-400 shrink-0" />
          <div>
            <span className="text-sm font-medium text-sky-600">Raining is happening</span>
            {(activeEnv.pm25RainDelta || 0) > 0 && (
              <span className="block text-xs text-sky-400/80 mt-0.5">
                PM2.5 reduced by {Number(activeEnv.pm25RainDelta).toFixed(1)} µg/m³
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Main grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left: Sensor tiles + Advisory */}
        <div className="lg:col-span-8 space-y-5">

          {/* Sensor grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
            {sensorTiles.map((tile) => {
              const color = sensorStatus(tile.id, tile.value);
              return (
                <div
                  key={tile.id}
                  className="glass-card rounded-xl p-6 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-(--color-text-secondary) opacity-60">{tile.label}</span>
                    <tile.icon size={16} className="text-(--color-text-secondary) opacity-40" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl lg:text-2xl font-bold text-(--color-text-primary) tabular-nums">
                      <AnimatedNum value={tile.value} decimals={tile.decimals} />
                    </span>
                    <span className="text-xs text-(--color-text-secondary) opacity-60">{tile.unit}</span>
                  </div>
                  {/* Status bar */}
                  <div className="mt-3 h-1 subtle-surface rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        backgroundColor: color,
                        width: `${Math.min((tile.value / tile.max) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Toxic Event Detection ──────────────────── */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" />
                <span className="text-base font-semibold text-(--color-text-primary)">Toxic Event Detection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${toxicAlerts[0]?.severity === 'danger' ? 'bg-rose-500' : toxicAlerts[0]?.severity === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                <span className="text-[11px] text-(--color-text-secondary) opacity-60">Real-time</span>
              </div>
            </div>
            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout">
                {toxicAlerts.map((alert) => {
                  const s = severityConfig[alert.severity] || severityConfig.info;
                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className={`${s.bg} border ${s.border} rounded-xl p-4 flex items-start gap-3`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.badge}`}>
                        <alert.icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold ${s.text}`}>{alert.label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${s.badge}`}>
                            {alert.severity}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed ${s.text} opacity-80`}>{alert.message}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Advisory */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} className="text-rose-400" />
              <span className="text-base font-semibold text-(--color-text-primary)">Health Advisory</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <p className="text-sm text-(--color-text-secondary) leading-relaxed max-w-xl">
                {activeDerived?.air_quality_text || 'Current air quality conditions are being monitored.'}
                {' '}Dominant pollutant: <span className="text-(--color-text-primary) font-medium">{activeDerived?.dominant || 'PM2.5'}</span>.
              </p>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-[11px] text-(--color-text-secondary) opacity-60">Risk Score</p>
                  <p className="text-2xl lg:text-xl font-bold tabular-nums" style={{ color: riskColor }}>
                    <AnimatedNum value={activeDerived?.rri || 0} />
                  </p>
                </div>
                <div className="w-px h-8 bg-card-border" />
                <div className="text-right">
                  <p className="text-[11px] text-(--color-text-secondary) opacity-60">AQI</p>
                  <p className="text-2xl lg:text-xl font-bold text-(--color-text-primary) tabular-nums">
                    <AnimatedNum value={activeDerived?.aqi || 0} />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Map + Events */}
        <div className="lg:col-span-4 space-y-5">

          {/* Map */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-(--color-card-border)">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-(--color-accent)" />
                <span className="text-xs font-medium text-(--color-text-secondary)">Sensor Map</span>
              </div>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <div className="h-[240px]">
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', background: 'var(--color-bg-main)' }} zoomControl={false} dragging={false}>
                <TileLayer key={isDark ? 'dark' : 'light'} url={tileUrl} />
                {sectors?.map((s, i) => (
                  <CircleMarker
                    key={s.id || i}
                    center={[s.lat || mapCenter[0] + (i * 0.018 - 0.03), s.lng || mapCenter[1] + (i * 0.015 - 0.03)]}
                    radius={8}
                    pathOptions={{
                      color: s.aqi > 100 ? '#f97316' : '#38bdf8',
                      fillColor: s.aqi > 100 ? '#f97316' : '#38bdf8',
                      fillOpacity: 0.7,
                      weight: 2,
                    }}
                  />
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Event Feed */}
          <div className="glass-card rounded-xl flex flex-col overflow-hidden min-h-[320px]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-(--color-card-border)">
              <span className="text-xs font-medium text-(--color-text-secondary)">Event Log</span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded">LIVE</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2 max-h-[360px] glass-scrollbar">
              <AnimatePresence mode="popLayout">
                {eventLog.map((event, i) => (
                  <motion.div
                    key={`${event.time}-${i}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`border rounded-lg p-3 ${eventColors[event.type]}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        {event.type === 'alert' ? 'Alert' : 'Update'}
                      </span>
                      <span className="text-xs font-mono opacity-60">{event.time}</span>
                    </div>
                    <p className="text-xs leading-relaxed">{event.message}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
              {eventLog.length === 0 && (
                <p className="text-xs text-(--color-text-secondary) opacity-40 text-center py-8">Waiting for events...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStatus;

