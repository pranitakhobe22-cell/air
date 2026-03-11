import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import {
  MapPin, Activity, Search, AlertTriangle, TrendingUp, X, Layers
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import useAerisStore from '@/store/aerisStore';
import useNodeStore from '@/store/useNodeStore';
import useThemeMode from '@/hooks/useThemeMode';
import 'leaflet/dist/leaflet.css';
import './MapPage.css';

const rriColor = (rri) => {
  if (rri >= 75) return '#ef4444';
  if (rri >= 55) return '#f97316';
  if (rri >= 35) return '#f59e0b';
  return '#22c55e';
};

const rriLabel = (rri) => {
  if (rri >= 75) return 'Critical';
  if (rri >= 55) return 'High';
  if (rri >= 35) return 'Moderate';
  return 'Safe';
};

const FitBounds = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) map.fitBounds(positions, { padding: [80, 80], maxZoom: 14 });
  }, [positions, map]);
  return null;
};

const FlyToNode = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 15, { duration: 1 });
  }, [center, map]);
  return null;
};

const MapPage = () => {
  const data = useAerisStore((s) => s.data);
  const userLocation = useNodeStore((s) => s.userLocation);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterMode, setFilterMode] = useState('rri');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAlerts, setShowAlerts] = useState(true);
  const isDark = useThemeMode();

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const subtleBg = isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]';

  // Default center: browser geolocation > first sector > fallback
  const defaultCenter = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [20.5937, 78.9629]; // India center as last resort

  if (!data?.derived) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { alerts, history, perNode } = data;
  const sectors = data.sectors || [];
  const espIds = new Set(Object.keys(perNode || {}));

  const markers = sectors.map((s, i) => ({
    ...s,
    lat: s.lat || defaultCenter[0] + (i * 0.006 - 0.006),
    lng: s.lng || defaultCenter[1] + (i * 0.008 - 0.008),
    rri: s.rri || Math.floor(s.aqi * 0.8),
    isHardware: espIds.has(s.id),
    nodeData: perNode?.[s.id] || null,
  })).filter((m) =>
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const positions = markers.map((m) => [m.lat, m.lng]);
  const center = positions.length > 0 ? positions[0] : defaultCenter;

  const sparkData = Array.isArray(history) && history.length > 0
    ? history.slice(-24).map((h) => ({ val: h.aqi }))
    : [];

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen w-full flex overflow-hidden relative" style={{ background: 'var(--color-bg-main)' }}>

      {/* Map */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%', background: 'var(--color-bg-main)' }}
          zoomControl={false}
          className="custom-map-tiles"
        >
          <TileLayer key={isDark ? 'dark' : 'light'} url={tileUrl} />
          <FitBounds positions={positions} />
          {selectedNode && <FlyToNode center={[selectedNode.lat, selectedNode.lng]} />}

          {markers.map((m) => {
            const val = filterMode === 'rri' ? m.rri : m.aqi;
            const color = rriColor(val);
            const isSelected = selectedNode?.id === m.id;

            return (
              <CircleMarker
                key={m.id}
                center={[m.lat, m.lng]}
                radius={isSelected ? 18 : m.isHardware ? 12 : 10}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: isSelected ? 0.7 : m.isHardware ? 0.55 : 0.4,
                  color,
                  weight: isSelected ? 3 : m.isHardware ? 2.5 : 1.5,
                }}
                eventHandlers={{
                  click: () => setSelectedNode(m),
                  mouseover: (e) => e.target.openPopup(),
                  mouseout: (e) => e.target.closePopup(),
                }}
              >
                <Popup className="custom-popup" closeButton={false}>
                  <div className="map-panel p-2.5 rounded-xl min-w-[140px]">
                    <div className="flex items-center gap-1.5 mb-1">
                      {m.isHardware && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">ESP32</span>}
                      <p className="text-xs text-(--color-text-secondary)">{m.name}</p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-(--color-text-primary) font-medium">AQI {m.aqi}</span>
                      <span className="font-medium" style={{ color }}>RRI {m.rri}</span>
                    </div>
                    {m.nodeData && (
                      <div className="flex gap-3 mt-1.5 pt-1.5 border-t border-(--color-card-border) text-xs text-(--color-text-secondary)">
                        <span>PM2.5: {m.nodeData.latest.pm25}</span>
                        <span>CO: {m.nodeData.latest.co}</span>
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Selected node panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed lg:absolute bottom-0 lg:top-4 left-0 lg:left-4 lg:bottom-4 w-full lg:w-72 max-h-[60vh] lg:max-h-none map-panel lg:rounded-2xl flex flex-col z-50 overflow-hidden rounded-t-2xl"
          >
            <div className="p-4 border-b border-(--color-card-border)">
              <button onClick={() => setSelectedNode(null)} className="absolute top-3 right-3 p-1.5 text-(--color-text-secondary) hover:text-(--color-text-primary) subtle-surface rounded-lg transition-colors">
                <X size={14} />
              </button>
              <h2 className="text-base font-bold text-(--color-text-primary) pr-8">{selectedNode.name}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin size={12} className="text-sky-400" />
                <span className="text-[11px] font-mono text-(--color-text-secondary)">{selectedNode.lat.toFixed(4)}, {selectedNode.lng.toFixed(4)}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedNode.isHardware && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-400">ESP32 Hardware</span>
                  <span className="text-xs font-mono text-(--color-text-secondary)">{selectedNode.id}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className={`${subtleBg} rounded-xl p-3 text-center`}>
                  <span className="text-2xl font-bold text-(--color-text-primary)">{selectedNode.aqi}</span>
                  <p className="text-[11px] text-(--color-text-secondary) mt-0.5">AQI</p>
                </div>
                <div className={`${subtleBg} rounded-xl p-3 text-center`}>
                  <span className="text-2xl font-bold" style={{ color: rriColor(selectedNode.rri) }}>{selectedNode.rri}</span>
                  <p className="text-[11px] text-(--color-text-secondary) mt-0.5">RRI</p>
                </div>
              </div>

              {selectedNode.nodeData && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'PM2.5', value: selectedNode.nodeData.latest.pm25, unit: 'µg/m³' },
                    { label: 'CO', value: selectedNode.nodeData.latest.co, unit: 'ppm' },
                    { label: 'O3', value: selectedNode.nodeData.latest.o3, unit: 'ppb' },
                    { label: 'Temp', value: selectedNode.nodeData.latest.temperature, unit: '°C' },
                  ].map((s) => (
                    <div key={s.label} className={`${subtleBg} rounded-lg px-2.5 py-2`}>
                      <span className="text-xs text-(--color-text-secondary)">{s.label}</span>
                      <p className="text-sm font-semibold text-(--color-text-primary) tabular-nums">{typeof s.value === 'number' ? s.value.toFixed(1) : s.value} <span className="text-[11px] text-(--color-text-secondary) font-normal">{s.unit}</span></p>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: `${rriColor(selectedNode.rri)}10`, color: rriColor(selectedNode.rri) }}>
                {rriLabel(selectedNode.rri)} Risk
              </div>

              <div>
                <p className="text-xs text-(--color-text-secondary) mb-2">Recent Trend</p>
                <div className={`h-20 ${subtleBg} rounded-xl p-1.5`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedNode.nodeData?.history?.map(h => ({ val: h.aqi })) || sparkData}>
                      <defs>
                        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={rriColor(selectedNode.rri)} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={rriColor(selectedNode.rri)} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="linear" dataKey="val" stroke={rriColor(selectedNode.rri)} fill="url(#sparkGrad)" strokeWidth={1.5} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top controls */}
      <div className="absolute top-3 left-3 right-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:top-4 z-50 flex items-center gap-2 lg:gap-3">
        <div className="relative flex-1 lg:flex-none">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)" />
          <input
            type="text"
            placeholder="Search sectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full lg:w-64 h-10 map-panel rounded-xl pl-9 pr-4 text-sm text-(--color-text-primary) focus:outline-none focus:ring-1 focus:ring-sky-500/40 placeholder:text-(--color-text-secondary)"
          />
        </div>

        <div className="flex map-panel rounded-xl p-0.5 shrink-0">
          {['aqi', 'rri'].map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-3 lg:px-4 py-1.5 rounded-lg text-xs font-medium uppercase transition-colors ${
                filterMode === m ? 'bg-sky-500/15 text-sky-400' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Right alerts panel - hidden on mobile */}
      <div className={`hidden lg:flex absolute top-16 right-4 bottom-4 w-72 flex-col z-40 transition-transform duration-300 ${showAlerts ? '' : 'translate-x-[120%]'}`}>
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className="absolute -left-10 top-0 p-2 map-panel rounded-xl text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors"
        >
          <Layers size={16} />
        </button>

        <div className="flex-1 map-panel rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-card-border)">
            <span className="text-xs font-medium text-(--color-text-secondary)">Alerts</span>
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {alerts?.length > 0 ? alerts.map((a, i) => (
              <div key={i} className="bg-red-500/[0.06] rounded-xl p-3">
                <p className="text-xs text-(--color-text-secondary) leading-relaxed">{a.message}</p>
              </div>
            )) : (
              <div className="bg-emerald-500/[0.06] rounded-xl p-3">
                <p className="text-xs text-emerald-400">No active alerts. All sectors clear.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={`absolute ${selectedNode ? 'hidden lg:flex' : 'flex'} bottom-4 left-1/2 -translate-x-1/2 z-40 map-panel rounded-xl px-3 lg:px-4 py-2 lg:py-2.5 items-center gap-3 lg:gap-5`}>
        {[
          { label: 'Safe', color: '#22c55e' },
          { label: 'Moderate', color: '#f59e0b' },
          { label: 'High', color: '#f97316' },
          { label: 'Critical', color: '#ef4444' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-[11px] text-(--color-text-secondary)">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapPage;
