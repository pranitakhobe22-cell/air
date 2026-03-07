import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Clock, MapPin, RefreshCw, Wind, Thermometer, Droplets, Heart, Gauge
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';
import useActiveNode from '@/hooks/useActiveNode';
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

/* ── Sensor color helper ──────────────────────────────── */
const sensorStatus = (id, val) => {
  const thresholds = {
    pm25: [12, 35, 55, 150],
    co: [4.4, 9.4, 12.4, 15.4],
    o3: [54, 70, 85, 105],
    voc: [100, 200, 300, 400],
  };
  const t = thresholds[id];
  if (!t) return '#94a3b8';
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
        <div>
          <div className="h-7 w-40 bg-slate-800/60 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-slate-800/40 rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-xl h-32 animate-pulse" />
            ))}
          </div>
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl h-64 animate-pulse" />
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
    { id: 'pm25', label: 'PM2.5', value: activeSensors.pm25, unit: 'ug/m3', icon: Activity, decimals: 1 },
    { id: 'o3', label: 'Ozone', value: activeSensors.o3, unit: 'ppb', icon: Wind, decimals: 1 },
    { id: 'co', label: 'CO', value: activeSensors.co, unit: 'ppm', icon: Gauge, decimals: 2 },
    { id: 'voc', label: 'VOC Index', value: activeSensors.voc_index, unit: 'idx', icon: Activity, decimals: 0 },
    { id: 'temp', label: 'Temperature', value: activeEnv?.temperature || activeSensors.temperature, unit: 'C', icon: Thermometer, decimals: 1 },
    { id: 'hum', label: 'Humidity', value: activeEnv?.humidity || activeSensors.humidity, unit: '%', icon: Droplets, decimals: 0 },
  ];

  const mapCenter = sectors?.[0]?.lat ? [sectors[0].lat, sectors[0].lng] : [21.1458, 79.0882];
  const riskColor = activeDerived?.risk_color || '#10b981';

  const eventColors = {
    alert: 'border-red-500/30 bg-red-500/5 text-red-400',
    sync: 'border-slate-700/50 bg-slate-800/30 text-slate-400',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6">

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Live Status</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time sensor readings &middot; {active.nodeName || meta?.location || 'Local Station'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <Clock size={14} className="text-slate-500" />
            <span className="text-xs text-slate-400 tabular-nums">{secondsAgo}s ago</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2 bg-slate-800/60 border border-slate-700/40 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left: Sensor tiles + Advisory */}
        <div className="lg:col-span-8 space-y-5">

          {/* Sensor grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sensorTiles.map((tile) => {
              const color = sensorStatus(tile.id, tile.value);
              return (
                <div
                  key={tile.id}
                  className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-500">{tile.label}</span>
                    <tile.icon size={16} className="text-slate-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white tabular-nums">
                      <AnimatedNum value={tile.value} decimals={tile.decimals} />
                    </span>
                    <span className="text-xs text-slate-500">{tile.unit}</span>
                  </div>
                  {/* Status bar */}
                  <div className="mt-3 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        backgroundColor: color,
                        width: `${Math.min((tile.value / (tile.id === 'pm25' ? 150 : tile.id === 'co' ? 15 : tile.id === 'o3' ? 120 : tile.id === 'voc' ? 500 : tile.id === 'temp' ? 50 : 100)) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Advisory */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} className="text-rose-400" />
              <span className="text-sm font-semibold text-slate-300">Health Advisory</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                {activeDerived?.air_quality_text || 'Current air quality conditions are being monitored.'}
                {' '}Dominant pollutant: <span className="text-slate-300 font-medium">{activeDerived?.dominant || 'PM2.5'}</span>.
              </p>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">Risk Score</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: riskColor }}>
                    <AnimatedNum value={activeDerived?.rri || 0} />
                  </p>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">AQI</p>
                  <p className="text-2xl font-bold text-white tabular-nums">
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
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/40">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-sky-400" />
                <span className="text-xs font-medium text-slate-400">Sensor Map</span>
              </div>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <div className="h-[240px]">
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', background: '#0f172a' }} zoomControl={false} dragging={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
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
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl flex flex-col overflow-hidden min-h-[320px]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/40">
              <span className="text-xs font-medium text-slate-400">Event Log</span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold rounded">LIVE</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[360px]">
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
                      <span className="text-[10px] font-semibold uppercase tracking-wide">
                        {event.type === 'alert' ? 'Alert' : 'Update'}
                      </span>
                      <span className="text-[10px] font-mono opacity-60">{event.time}</span>
                    </div>
                    <p className="text-xs leading-relaxed">{event.message}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
              {eventLog.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-8">Waiting for events...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStatus;
