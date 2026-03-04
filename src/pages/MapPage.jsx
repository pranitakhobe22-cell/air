import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { 
  MapPin, Activity, Wifi, Shield, Wind, Crosshair, Search, 
  Layers, AlertTriangle, TrendingUp, X
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import useAerisStore from '@/store/aerisStore';
import 'leaflet/dist/leaflet.css';
import './MapPage.css';

// ── Helpers ──────────────────────────────────────────────────

const rriToColor = (rri) => {
  if (rri >= 75) return '#ef4444'; // Red
  if (rri >= 55) return '#f97316'; // Orange
  if (rri >= 35) return '#f59e0b'; // Amber
  return '#10b981';                // Green
};

const rriToLevel = (rri) => {
  if (rri >= 75) return 'Critical';
  if (rri >= 55) return 'High';
  if (rri >= 35) return 'Moderate';
  return 'Safe';
};

// Component to handle auto-fitting bounds when markers change
const FitBounds = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, { padding: [100, 100], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
};

// Component to fly to selected node
const FlyToNode = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
};

// Mini sparkline for the side panel
const MiniSparkline = ({ data, color }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data}>
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.5}/>
          <stop offset="95%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <Area 
        type="monotone" 
        dataKey="val" 
        stroke={color} 
        fill={`url(#gradient-${color})`} 
        strokeWidth={2} 
        isAnimationActive={false} 
      />
    </AreaChart>
  </ResponsiveContainer>
);

// ── Map Page Component ────────────────────────────────────────

const MapPage = () => {
  const { data, fetchLatest } = useAerisStore();
  const [selectedNode, setSelectedNode] = useState(null);
  const [envMode, setEnvMode] = useState('outdoor');
  const [filterMode, setFilterMode] = useState('rri'); // 'aqi' or 'rri'
  const [searchQuery, setSearchQuery] = useState('');
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Poll 8s
  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 8000);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  if (!data?.sectors || !data?.nodes) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Constructing Spatial Grid...</span>
      </div>
    );
  }

  const { sectors, nodes, derived, history, alerts } = data;

  // Enhance sectors into map markers
  const markers = sectors.map(sector => ({
    ...sector,
    lat: sector.lat || 40.7128 + (Math.random() - 0.5) * 0.1,
    lng: sector.lng || -74.0060 + (Math.random() - 0.5) * 0.1,
    rri: sector.rri || Math.floor(sector.aqi * 0.8), // simulated RRI if missing per sector
  })).filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const positions = markers.map(m => [m.lat, m.lng]);
  // Default to a central point if no markers
  const initialCenter = positions.length > 0 ? positions[0] : [40.7128, -74.0060];

  // Simulated 24h history for sparkline
  const sparklineData = Array.isArray(history) && history.length > 0 
    ? history.slice(-24).map(h => ({ val: h.aqi }))
    : Array.from({length: 24}, () => ({ val: 40 + Math.random()*60 }));

  return (
    <div className="h-screen w-full bg-[#0B0F1A] text-slate-100 flex overflow-hidden relative selection:bg-sky-500/30">
      
      {/* ── Background Map ──────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={initialCenter}
          zoom={12}
          style={{ height: '100%', width: '100%', background: '#0B0F1A' }}
          zoomControl={false}
          className="leaflet-dark custom-map-tiles"
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          
          <FitBounds positions={positions} />
          {selectedNode && <FlyToNode center={[selectedNode.lat, selectedNode.lng]} />}

          {markers.map(marker => {
            const val = filterMode === 'rri' ? marker.rri : marker.aqi;
            const color = rriToColor(val);
            const isSelected = selectedNode?.id === marker.id;
            const radius = isSelected ? 24 : val > 100 ? 18 : 12;

            return (
              <CircleMarker
                key={marker.id}
                center={[marker.lat, marker.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: isSelected ? 0.8 : 0.4,
                  color: color,
                  weight: isSelected ? 4 : 2,
                  className: `marker-pulse ${isSelected ? 'marker-selected' : ''}`
                }}
                eventHandlers={{
                  click: () => setSelectedNode(marker),
                  mouseover: (e) => e.target.openPopup(),
                  mouseout: (e) => e.target.closePopup(),
                }}
              >
                <Popup className="custom-popup" closeButton={false}>
                  <div className="bg-[#111827]/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl min-w-[140px]">
                     <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{marker.name}</div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-white">AQI: {marker.aqi}</span>
                        <span className="text-sm font-bold" style={{ color }}>RRI: {marker.rri}</span>
                     </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
        {/* Deep dark vignette over map */}
        <div className="absolute inset-0 shadow-[inset_0_0_150px_#0B0F1A] pointer-events-none z-400" />
      </div>

      {/* ── Left Floating Panel (Details) ───────────────────── */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div 
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-6 left-6 bottom-6 w-80 bg-[#111827]/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 relative">
              <button 
                onClick={() => setSelectedNode(null)} 
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 rounded-full transition-colors"
               >
                <X size={16} />
              </button>
              <h2 className="text-xl font-black text-white pr-8">{selectedNode.name}</h2>
              <div className="flex items-center space-x-2 mt-2">
                <MapPin size={12} className="text-sky-400" />
                <span className="text-[10px] font-mono text-slate-400 tracking-widest">
                  {selectedNode.lat.toFixed(4)}, {selectedNode.lng.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Primary Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-center items-center relative overflow-hidden">
                  <div className="absolute top-0 w-full h-1 bg-sky-500" />
                  <span className="text-4xl font-black text-white tracking-tighter mb-1">{selectedNode.aqi}</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Local AQI</span>
                </div>
                
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-center items-center relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]">
                  <div className="absolute top-0 w-full h-1" style={{ backgroundColor: rriToColor(selectedNode.rri) }} />
                  <span className="text-4xl font-black tracking-tighter mb-1" style={{ color: rriToColor(selectedNode.rri) }}>
                    {selectedNode.rri}
                  </span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Threat RRI</span>
                </div>
              </div>

              {/* Status Band */}
              <div className="px-4 py-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: `${rriToColor(selectedNode.rri)}15`, border: `1px solid ${rriToColor(selectedNode.rri)}30` }}>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: rriToColor(selectedNode.rri) }}>
                  {rriToLevel(selectedNode.rri)} RISK
                </span>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: rriToColor(selectedNode.rri) }} />
              </div>

              {/* Dominant Pollutant */}
              <div>
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-3">Dominant Factor</h3>
                <div className="bg-[#0B0F1A]/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Activity size={18} className="text-orange-400" />
                    <span className="font-bold text-slate-200">PM2.5 Spikes</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">Industrial</span>
                </div>
              </div>

              {/* Mini 24h Trend Chart */}
              <div className="h-32">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-2 flex items-center space-x-2">
                  <TrendingUp size={12} /> <span>24H Trajectory</span>
                </h3>
                <div className="h-24 w-full bg-white/5 rounded-xl border border-white/5 p-2 pb-0">
                  <MiniSparkline data={sparklineData} color={rriToColor(selectedNode.rri)} />
                </div>
              </div>

            </div>

            {/* Footer Action */}
            <div className="p-6 border-t border-white/5 bg-[#0B0F1A]/50">
              <button className="w-full py-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex justify-center items-center space-x-2">
                <Crosshair size={14} /> <span>Set as Anchor</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Controls Bar ──────────────────────────────────── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-4">
        
        {/* Search */}
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search Sector or Node..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-80 h-12 bg-[#111827]/90 backdrop-blur-md border border-white/10 rounded-full pl-12 pr-6 text-sm font-medium text-white focus:outline-hidden focus:border-sky-500/50 shadow-2xl transition-colors placeholder:text-slate-500"
          />
        </div>

        {/* Filter Toggle AQI/RRI */}
        <div className="flex bg-[#111827]/90 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-2xl">
          <button 
            onClick={() => setFilterMode('aqi')}
            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === 'aqi' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            AQI Map
          </button>
          <button 
            onClick={() => setFilterMode('rri')}
            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === 'rri' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/10' : 'text-slate-500 hover:text-slate-300'}`}
          >
            RRI Map
          </button>
        </div>

        {/* Indoor/Outdoor Toggle */}
        <div className="flex bg-[#111827]/90 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-2xl">
          <button 
            onClick={() => setEnvMode('indoor')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${envMode === 'indoor' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Shield size={14} /> <span>In</span>
          </button>
          <button 
            onClick={() => setEnvMode('outdoor')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${envMode === 'outdoor' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Wind size={14} /> <span>Out</span>
          </button>
        </div>

      </div>

      {/* ── Right Floating Panel (Alerts Feed) ──────────────── */}
      <div className={`absolute top-24 right-6 bottom-6 w-80 flex flex-col z-40 transition-transform duration-500 ${showRightPanel ? 'translate-x-0' : 'translate-x-[120%]'}`}>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setShowRightPanel(!showRightPanel)}
          className="absolute -left-12 top-0 p-3 bg-[#111827]/80 backdrop-blur-md border border-white/10 rounded-xl text-slate-400 hover:text-white transition-colors shadow-2xl"
        >
          <Layers size={18} />
        </button>

        <div className="flex-1 bg-[#111827]/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-300 flex items-center space-x-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <span>AI Alerts Feed</span>
            </h3>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {alerts && alerts.length > 0 ? (
              alerts.map((alert, i) => (
                <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Critical Spike</span>
                     <span className="text-[9px] font-mono text-slate-500">Just now</span>
                   </div>
                   <p className="text-xs font-medium text-red-200 leading-relaxed">
                     {alert.message}
                   </p>
                </div>
              ))
            ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Sector Clear</span>
                   </div>
                   <p className="text-xs font-medium text-emerald-200 leading-relaxed">
                     No critical anomalies detected in the mesh grid.
                   </p>
                </div>
            )}
            
            {/* Simulated historical alerts */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 opacity-70">
               <div className="flex justify-between items-start mb-2">
                 <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Wind Shift Warning</span>
                 <span className="text-[9px] font-mono text-slate-500">-2h</span>
               </div>
               <p className="text-xs font-medium text-slate-300 leading-relaxed">
                 Northeastern winds may push industrial PM10 towards residential sectors.
               </p>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 opacity-60">
               <div className="flex justify-between items-start mb-2">
                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Node Sync Loss</span>
                 <span className="text-[9px] font-mono text-slate-500">-4h</span>
               </div>
               <p className="text-xs font-medium text-slate-300 leading-relaxed">
                 Node N-003 disconnected. Last known battery state: Critical.
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Center Legend & Guidance ─────────────────── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#111827]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center space-x-8">
         <div className="flex items-center space-x-6 pr-6 border-r border-white/10">
           {[
             { label: 'Safe', color: '#10b981' },
             { label: 'Moderate', color: '#f59e0b' },
             { label: 'High', color: '#f97316' },
             { label: 'Critical', color: '#ef4444' },
           ].map(l => (
             <div key={l.label} className="flex items-center space-x-2">
               <div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: l.color, color: l.color }} />
               <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{l.label}</span>
             </div>
           ))}
         </div>
         <div className="flex items-center space-x-3 text-amber-400">
            <AlertTriangle size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sensitive Groups Rule Active</span>
         </div>
      </div>

    </div>
  );
};

export default MapPage;
