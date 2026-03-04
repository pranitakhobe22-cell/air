import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Clock, AlertTriangle, Cpu, Database, Zap, MapPin, 
  TrendingUp, RefreshCw, Wind, Shield, Thermometer, Droplets, Heart
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ── Components ──────────────────────────────────────────────────

const CountUp = ({ end, duration = 1500, decimals = 0 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (end === undefined || end === null) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(progress * end);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);
  return <>{count.toFixed(decimals)}</>;
};

const StatusDot = ({ pulse = true, color = "bg-emerald-500", glow = "shadow-[0_0_10px_rgba(16,185,129,0.8)]" }) => (
  <div className={`w-2 h-2 rounded-full ${color} ${pulse ? 'animate-pulse' : ''} ${glow}`} />
);

// ── Live Status Page ──────────────────────────────────────────

const LiveStatus = () => {
  const { data, loading, fetchLatest } = useAerisStore();
  const [eventLog, setEventLog] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [envMode, setEnvMode] = useState('outdoor'); // indoor | outdoor
  const prevDataRef = useRef(null);

  // Poll 8s as per requirement "Poll API every 8 seconds"
  useEffect(() => {
    fetchLatest();
    const interval = setInterval(() => {
      fetchLatest();
      setLastUpdate(new Date());
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  // Build simulated tactical event log
  useEffect(() => {
    if (!data) return;
    const events = [];
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (data.alerts?.length > 0) {
      data.alerts.slice(0, 1).forEach(a => {
        events.push({ time: ts, type: 'alert', title: 'TOXIC SPIKE DETECTED', message: a.message, severity: 'critical' });
      });
    }
    
    // Simulate some tactical events to make it feel alive
    if (Math.random() > 0.7) {
      const msgs = [
        "Industrial emission spike detected in Sector 4.",
        "Dust storm approaching from North perimeter.",
        "PM10 concentration normalized after wind shift.",
        "Sensor Node N-003 re-established uplink.",
        "Risk Engine calculated new baseline group risks."
      ];
      const type = Math.random() > 0.8 ? 'warning' : 'info';
      const title = type === 'warning' ? 'ENVIRONMENTAL SHIFT' : 'SYSTEM UPDATE';
      events.push({ time: ts, type, title, message: msgs[Math.floor(Math.random() * msgs.length)], severity: type });
    }
    
    events.push({ time: ts, type: 'sync', title: 'MESH SYNC', message: 'Nodes reported back to AI core.', severity: 'normal' });
    
    setEventLog(prev => [...events, ...prev].slice(0, 50));
    prevDataRef.current = data;
  }, [data]);

  if (!data?.sensors) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Awaiting Telemetry...</span>
      </div>
    );
  }

  const { sensors, environment, derived, sectors, meta } = data;
  const secondsSinceUpdate = Math.floor((new Date() - lastUpdate) / 1000);

  // Enhancing the payload
  const fullSensors = {
    ...sensors,
    temp: environment?.temperature || 24.5,
    humidity: environment?.humidity || 45
  };

  const largeTiles = [
    { id: 'pm25', label: 'PM2.5', value: fullSensors.pm25, unit: 'µg/m³', color: '#ef4444', icon: Activity },
    { id: 'co', label: 'CO', value: fullSensors.co, unit: 'ppm', color: '#f59e0b', icon: Activity, decimals: 1 },
    { id: 'voc', label: 'VOC', value: fullSensors.voc_index, unit: 'Index', color: '#8b5cf6', icon: Activity },
    { id: 'o3', label: 'Ozone', value: fullSensors.o3, unit: 'ppb', color: '#0ea5e9', icon: Activity },
    { id: 'temp', label: 'Temperature', value: fullSensors.temp, unit: '°C', color: '#f43f5e', icon: Thermometer, decimals: 1 },
    { id: 'hum', label: 'Humidity', value: fullSensors.humidity, unit: '%', color: '#06b6d4', icon: Droplets },
  ];

  const logColors = {
    alert: 'border-red-500/30 bg-red-500/10 text-red-400',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    sync: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  };

  const mapCenter = [40.7128, -74.0060]; // Example static center for heatmap

  return (
    <div className="p-8 pb-32 max-w-[1800px] mx-auto space-y-6 text-slate-100 selection:bg-sky-500/30">
      
      {/* ── Top Header Bar ──────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111827]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center space-x-4 mb-2">
            <span>Live Sector Intelligence</span>
            <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
               <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
               <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest leading-none mt-0.5">Engine Active</span>
            </div>
          </h1>
          <p className="text-sm text-slate-400 font-medium">Real-time tactical environmental stream • Sector: {meta?.location}</p>
        </div>
        
        <div className="flex items-center space-x-6">
          {/* Indoor/Outdoor Toggle */}
          <div className="flex bg-[#0B0F1A] border border-white/5 rounded-full p-1 shadow-inner">
            <button 
              onClick={() => setEnvMode('indoor')}
              className={`flex items-center space-x-2 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${envMode === 'indoor' ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Shield size={14} /> <span className="mt-0.5">Indoor</span>
            </button>
            <button 
              onClick={() => setEnvMode('outdoor')}
              className={`flex items-center space-x-2 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${envMode === 'outdoor' ? 'bg-sky-500/20 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Wind size={14} /> <span className="mt-0.5">Outdoor</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-2 px-4 py-2 bg-[#0B0F1A] rounded-xl border border-white/5">
            <Clock size={16} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest w-24 text-center">
              SYNC {secondsSinceUpdate}S AGO
            </span>
          </div>

          <button onClick={fetchLatest} className="p-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors group">
            <RefreshCw size={18} className={`${loading ? 'animate-spin text-sky-400' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          </button>
        </div>
      </div>

      {/* ── Main Layout Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── Left Column: Live Tiles ─────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">
           <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {largeTiles.map((tile, i) => (
                <motion.div
                  key={tile.id}
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={{ delay: i * 0.05 }}
                  className="bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:shadow-2xl transition-all duration-300"
                  style={{ '--hover-color': tile.color }}
                >
                  <div className="absolute -bottom-8 -right-8 opacity-10 blur-xl group-hover:opacity-30 transition-opacity duration-500">
                    <tile.icon size={120} style={{ color: tile.color }} />
                  </div>
                  
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{tile.label}</h3>
                  
                  <div className="flex items-end justify-between relative z-10 space-x-2">
                    <span 
                       className="text-6xl font-black tracking-tighter" 
                       style={{ color: tile.color, textShadow: `0 0 30px ${tile.color}40` }}
                    >
                      <CountUp end={tile.value} decimals={tile.decimals || 0} />
                    </span>
                    <span className="text-sm font-bold uppercase text-slate-600 mb-2">{tile.unit}</span>
                  </div>
                </motion.div>
              ))}
           </div>

           {/* ── Advisory Panel ─────────────────────────────── */}
           <div className="bg-linear-to-r from-slate-900/60 to-[#111827]/60 backdrop-blur-xl border border-white/5 hover:border-white/10 rounded-3xl p-8 flex flex-col justify-center transition-colors">
              <div className="flex items-center space-x-3 mb-4">
                <Heart size={20} className="text-pink-500" />
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-pink-500">Personal Intelligence Advisory</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                 <div className="md:col-span-8 text-xl font-medium text-slate-300 leading-relaxed">
                   {derived.air_quality_text || 'Monitoring baseline conditions.'}
                   {" "}Your localized RRI modifier is active. Currently, prolonged exposure to ambient {derived.dominant || 'PM2.5'} is <span className="text-orange-400 font-bold">NOT</span> recommended.
                 </div>
                 <div className="md:col-span-4 flex justify-end">
                    <div className="text-right">
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-1">RRI Threat Score</span>
                       <span className="text-5xl font-black tracking-tighter" style={{ color: derived.risk_color || '#f59e0b' }}>
                         <CountUp end={derived.rri} />
                       </span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* ── Right Column: Event Log & Map ───────────────────── */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
           
           {/* Spatial Heatmap Preview */}
           <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-5 relative overflow-hidden h-[300px] flex flex-col group">
              <div className="flex items-center justify-between z-20 relative mb-4">
                 <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center space-x-2">
                   <MapPin size={16} className="text-sky-400" />
                   <span>Spatial Heatmap</span>
                 </h3>
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              </div>

              <div className="absolute inset-0 top-14 rounded-b-3xl overflow-hidden border-t border-white/5">
                 <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', background: '#0B0F1A' }} zoomControl={false} dragging={false}>
                   <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                   <CircleMarker center={mapCenter} radius={80} pathOptions={{ color: derived.risk_color || '#10b981', fillColor: derived.risk_color || '#10b981', fillOpacity: 0.2, weight: 0 }} />
                   {sectors?.map((s, i) => (
                     <CircleMarker key={i} center={[mapCenter[0] + (Math.random()-0.5)*0.06, mapCenter[1] + (Math.random()-0.5)*0.06]} radius={10}
                        pathOptions={{ color: s.aqi > 100 ? '#f97316' : '#38bdf8', fillColor: s.aqi > 100 ? '#f97316' : '#38bdf8', fillOpacity: 0.8 }}
                     />
                   ))}
                 </MapContainer>
                 {/* Internal Vignette shadow */}
                 <div className="absolute inset-0 shadow-[inset_0_0_60px_#0B0F1A] pointer-events-none z-400" />
              </div>
           </div>

           {/* Tactical Scrollable Feed */}
           <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl flex-1 flex flex-col overflow-hidden min-h-[400px]">
              <div className="p-6 border-b border-white/5 bg-slate-900/30 flex justify-between items-center">
                 <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center space-x-2">
                   <Activity size={16} className="text-emerald-400" />
                   <span>Tactical Intelligence Feed</span>
                 </h3>
                 <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest rounded">LIVE</span>
              </div>
              
              {/* Event Scroller */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                 <AnimatePresence mode="popLayout">
                    {eventLog.map((event, i) => (
                      <motion.div
                        key={`${event.time}-${i}`}
                        initial={{ opacity: 0, x: 20, height: 0 }} animate={{ opacity: 1, x: 0, height: 'auto' }} exit={{ opacity: 0 }}
                        className={`border rounded-2xl p-4 transition-colors ${logColors[event.type]}`}
                      >
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest">{event.title}</span>
                           <span className="text-[10px] font-mono opacity-60 bg-black/20 px-2 py-0.5 rounded">{event.time}</span>
                         </div>
                         <p className="text-sm font-medium opacity-90 leading-snug">{event.message}</p>
                      </motion.div>
                    ))}
                 </AnimatePresence>
                 {eventLog.length === 0 && <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center py-12 animate-pulse">Awaiting mesh signals...</p>}
              </div>
           </div>

        </div>

      </div>
    </div>
  );
};

export default LiveStatus;
