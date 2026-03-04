import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, MapPin, Bell, User, TrendingUp, TrendingDown, Minus,
  Wind, Droplets, Thermometer, Zap, Shield, AlertTriangle, 
  ChevronRight, ChevronDown, RefreshCw, Search, LayoutDashboard,
  Map as MapIcon, AlertCircle, Database, Clock, 
  MapPinOff, Navigation, Sun, Moon, Maximize2, Crosshair,
  Brain, Network
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line
} from 'recharts';
import useAerisStore from '@/store/aerisStore';
import { getAtmosphereTheme } from '@/utils/atmosphereTheme';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ── Helpers ──────────────────────────────────────────────────

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

// ── Components ──────────────────────────────────────────────────

const MiniSparkline = ({ data, color, dataKey = 'val', type = 'area', chartTokens }) => (
  <ResponsiveContainer width="100%" height="100%">
    {type === 'area' ? (
      <AreaChart data={data}>
        <Area 
          type="monotone" 
          dataKey={dataKey} 
          stroke={chartTokens?.line || color} 
          fill={chartTokens?.area || `${color}22`} 
          strokeWidth={chartTokens?.thickness || 2} 
          isAnimationActive={false} 
        />
      </AreaChart>
    ) : (
      <LineChart data={data}>
        <Line 
          type="monotone" 
          dataKey={dataKey} 
          stroke={chartTokens?.line || color} 
          strokeWidth={chartTokens?.thickness || 2} 
          dot={false} 
          isAnimationActive={false} 
        />
      </LineChart>
    )}
  </ResponsiveContainer>
);

const PollutantCard = ({ name, value, unit, trend, history = [], color = '#38bdf8', chartTokens }) => {
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  const iconColor = isUp ? 'text-red-400' : isDown ? 'text-emerald-400' : 'text-slate-400';
  const bgIcon = isUp ? 'bg-red-500/10' : isDown ? 'bg-emerald-500/10' : 'bg-slate-500/10';
  
  return (
    <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/5 p-4 rounded-3xl hover:-translate-y-1 hover:shadow-2xl hover:shadow-sky-500/10 hover:bg-[#111827]/80 transition-all duration-300 group flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{name}</span>
        <span className={`p-1.5 rounded-lg ${bgIcon} ${iconColor}`}>
          {isUp ? <TrendingUp size={14} /> : isDown ? <TrendingDown size={14} /> : <Minus size={14} />}
        </span>
      </div>
      <div className="flex items-baseline space-x-1">
        <span className="text-2xl font-black tracking-tight text-white"><CountUp end={value} decimals={name === 'CO' ? 1 : 0} /></span>
        <span className="text-[9px] font-bold text-slate-600 uppercase">{unit}</span>
      </div>
      <div className="h-8 mt-3 opacity-50 group-hover:opacity-100 transition-opacity">
        <MiniSparkline data={history} color={isUp ? '#f87171' : isDown ? '#34d399' : color} chartTokens={chartTokens} />
      </div>
    </div>
  );
};

// ── Main Dashboard ───────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, loading, error, fetchLatest } = useAerisStore();

  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [environmentMode, setEnvironmentMode] = useState('outdoor'); // indoor | outdoor
  const [trendRange, setTrendRange] = useState('24h'); // 24h | 7d
  const [isAiExpanded, setIsAiExpanded] = useState(false);
  
  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 6000);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">Initializing Core Systems...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Sync Connection Failure</h2>
        <p className="text-slate-400 max-w-md mb-6">{error}</p>
        <button onClick={() => fetchLatest()} className="px-8 py-3 bg-slate-800 rounded-full font-bold hover:bg-slate-700 transition-all text-white">
          Retry Sequence
        </button>
      </div>
    );
  }

  if (!data || !data.sensors || !data.derived) return null;

  const { sensors, derived, environment, sectors, alerts, nodes, history, forecast, meta } = data;
  const currentTheme = getAtmosphereTheme(derived.aqi, derived.risk_level);

  // Enhance sensor data with static temp/humidity if missing
  const fullSensors = {
    ...sensors,
    temp: environment?.temperature || 24.5,
    humidity: environment?.humidity || 45
  };

  const groupRisks = [
    { id: 'children', label: 'Children', multiplier: 1.25, icon: User },
    { id: 'elderly', label: 'Elderly', multiplier: 1.35, icon: User },
    { id: 'asthma', label: 'Asthma', multiplier: 1.6, icon: Wind },
    { id: 'smokers', label: 'Smokers', multiplier: 1.4, icon: Zap },
  ];

  const historyData = Array.isArray(history) ? history.slice(-24) : [];
  const forecastData = Array.isArray(forecast) ? forecast.slice(0, 12) : [];
  
  const trendData = [...historyData, ...forecastData].map((item, idx) => ({
    time: item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit' }) : `+${idx-historyData.length+1}h`,
    aqi: item.aqi || 0,
    rri: item.rri || 0,
    isForecast: !item.timestamp
  }));

  const mapCenter = [40.7128, -74.0060]; // Example static center

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-100 font-sans selection:bg-sky-500/30">
      
      {/* ── Sticky Top Navigation ─────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-[#0B0F1A]/80 backdrop-blur-xl border-b border-white/5 px-8 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Location Selector */}
          <div className="flex items-center space-x-3 px-4 py-2 bg-[#111827]/80 hover:bg-white/5 border border-white/5 rounded-full cursor-pointer transition-colors group">
            <MapPin size={16} className="text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">{meta?.location || 'Sector Alpha'}</span>
            <ChevronDown size={14} className="text-slate-500" />
          </div>

          {/* Indoor / Outdoor Toggle */}
          <div className="hidden md:flex bg-[#111827]/80 border border-white/5 rounded-full p-1">
            <button 
              onClick={() => setEnvironmentMode('indoor')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${environmentMode === 'indoor' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Shield size={12} /> <span>Indoor</span>
            </button>
            <button 
              onClick={() => setEnvironmentMode('outdoor')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${environmentMode === 'outdoor' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Wind size={12} /> <span>Outdoor</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden lg:flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
            <Database size={12} className="text-emerald-500" />
            <span>Sensors Online</span>
            <StatusDot />
          </div>
          
          <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <Bell size={20} />
            {alerts?.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0B0F1A] animate-pulse"></span>
            )}
          </button>
          
          <div className="flex items-center space-x-3 cursor-pointer group">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white leading-none">Aria Vance</div>
              <div className="text-[9px] font-black text-sky-400 uppercase tracking-widest">Profile Active</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-sky-500 to-indigo-600 flex items-center justify-center border-2 border-[#0B0F1A] shadow-[0_0_15px_rgba(56,189,248,0.4)] group-hover:scale-105 transition-transform">
              <User size={18} className="text-white" />
            </div>
          </div>
        </div>
      </nav>

      <main className="px-8 py-8 max-w-[1800px] mx-auto space-y-6">
        
        {/* ── Realtime Alert Banner ────────────────────────────── */}
        <AnimatePresence>
          {alerts?.length > 0 && !isAlertDismissed && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -20 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -20 }}
              className="bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.15)] backdrop-blur-md"
            >
              <div className="flex items-center">
                <div className="p-4 bg-red-500/20 flex items-center justify-center self-stretch">
                  <AlertTriangle size={24} className="text-red-500 animate-pulse" />
                </div>
                <div className="px-6 py-4">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] block mb-1">Toxic Event Detection</span>
                  <p className="text-sm font-bold text-red-100">{alerts[0].message} • Evade outdoor exposure directly.</p>
                </div>
              </div>
              <div className="px-6">
                <button onClick={() => setIsAlertDismissed(true)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <Minus size={16} className="text-white/50" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Hero Top Row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: Location Context */}
          <div className="col-span-1 lg:col-span-3 bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col justify-between hover:-translate-y-1 hover:shadow-2xl hover:shadow-sky-500/10 transition-all duration-300">
            <div>
              <div className="flex items-center space-x-2 text-slate-400 mb-6">
                <MapPin size={16} />
                <span className="text-xs font-black uppercase tracking-[0.2em]">{meta?.location || 'Sector Alpha'}</span>
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white mb-2">{derived.aqi_category || 'Scanning'}</h2>
              <div className="inline-block px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest text-slate-800" style={{ backgroundColor: derived.risk_color || '#10b981' }}>
                {derived.risk_level || 'Safe'}
              </div>
            </div>
            <div className="mt-8 space-y-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Dominant Pollutant</span>
                <span className="text-lg font-black text-white">{derived.dominant || 'PM2.5'}</span>
              </div>
              <div className="text-xs font-medium text-slate-400 leading-relaxed">
                Atmospheric conditions indicate a {data.trend === 'up' ? 'rising' : 'stable'} presence of particulate matter.
              </div>
            </div>
          </div>

          {/* Center Panel: Massive AQI / RRI Display */}
          <div className="col-span-1 lg:col-span-5 bg-[#0B0F1A]/80 backdrop-blur-3xl border border-white/5 rounded-3xl p-8 relative overflow-hidden flex flex-col items-center justify-center shadow-2xl">
            {/* Colored Ambient Glow Behind */}
            <div className="absolute inset-0 opacity-20 transition-colors duration-1000 blur-[100px]" style={{ backgroundColor: derived.risk_color || '#10b981' }} />
            
            <div className="absolute top-6 left-6 flex items-center space-x-2">
               <Clock size={14} className="text-slate-500" />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Update: {new Date().toLocaleTimeString()}</span>
            </div>

            <div className="relative z-10 flex items-center space-x-12">
              {/* AQI Block */}
              <div className="text-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Global AQI</span>
                <div className="text-8xl font-black tracking-tighter" style={{ color: derived.risk_color || '#10b981', textShadow: `0 0 40px ${derived.risk_color}80` }}>
                  <CountUp end={derived.aqi} />
                </div>
              </div>

              {/* RRI Orb */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="absolute w-full h-full -rotate-90">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  <motion.circle 
                    cx="80" cy="80" r="70" fill="none" strokeWidth="8"
                    strokeDasharray="440"
                    initial={{ strokeDashoffset: 440 }}
                    animate={{ strokeDashoffset: 440 - (440 * (derived.rri || 0) / 100) }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    stroke="#38bdf8"
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.5))' }}
                  />
                </svg>
                <div className="text-center z-10">
                  <span className="text-4xl font-black text-white tracking-tight block leading-none"><CountUp end={derived.rri} /></span>
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mt-1 block">RRI</span>
                </div>
              </div>
            </div>

            <div className="absolute bottom-6 w-full px-8 flex justify-between items-center z-10">
              <div className="flex items-center space-x-2">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Live Sync</span>
              </div>
              <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
                 AERIS Core Intelligence
              </div>
            </div>
          </div>

          {/* Right Panel: AI Advisory */}
          <div className="col-span-1 lg:col-span-4 bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <Brain size={20} className="text-indigo-400" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">AI Health Advisory</h3>
              </div>
            </div>

            <div className="flex-1 space-y-4 relative">
               <p className="text-xl font-bold text-white leading-snug">
                 {derived.air_quality_text || "Air quality is favorable. Maintain normal activity."}
               </p>
               
               <AnimatePresence>
                 {isAiExpanded && (
                   <motion.div 
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     exit={{ opacity: 0, height: 0 }}
                     className="text-sm font-medium text-slate-400 leading-relaxed pt-2 border-t border-white/5"
                   >
                     Based on personal health modifiers (Asthma: +60% risk factor) and the rising trajectory of particulate matter (PM2.5 trending upwards), we strongly recommend indoor filtration activation within the next 4 hours.
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>

            <button 
              onClick={() => setIsAiExpanded(!isAiExpanded)}
              className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-slate-300 flex items-center justify-center space-x-2 transition-colors uppercase tracking-widest"
            >
              <span>{isAiExpanded ? 'Collapse Analysis' : 'Expand Analysis'}</span>
              <ChevronDown size={14} className={`transform transition-transform ${isAiExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

        </div>

        {/* ── Sensor Grid (8 Parameters) ────────────────────────── */}
        <div className="py-2">
          <div className="flex items-center space-x-3 mb-4">
            <Activity size={16} className="text-slate-500" />
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Live Telemetry Array</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
            <PollutantCard name="PM2.5" value={fullSensors.pm25} unit="µg/m³" trend={data.trend} history={historyData.map(i => ({ val: i.pm25 }))} color="#ef4444" chartTokens={currentTheme.chartTokens} />
            <PollutantCard name="PM10" value={fullSensors.pm10} unit="µg/m³" trend="stable" history={historyData.map(i => ({ val: i.pm10 || i.pm25*1.2 }))} color="#f97316" chartTokens={currentTheme.chartTokens} />
            <PollutantCard name="CO" value={fullSensors.co} unit="ppm" trend="down" history={historyData.map(i => ({ val: i.co }))} color="#eab308" chartTokens={currentTheme.chartTokens} />
            <PollutantCard name="VOC" value={fullSensors.voc_index} unit="Index" trend="stable" history={historyData.map(i => ({ val: i.voc_index }))} color="#8b5cf6" chartTokens={currentTheme.chartTokens} />
            <PollutantCard name="NOx" value={fullSensors.nox} unit="ppb" trend="up" history={historyData.map(i => ({ val: i.nox || i.co*20 }))} color="#ec4899" chartTokens={currentTheme.chartTokens} />
            <PollutantCard name="Ozone" value={fullSensors.o3} unit="ppb" trend="stable" history={historyData.map(i => ({ val: i.o3 }))} color="#0ea5e9" chartTokens={currentTheme.chartTokens} />
            <PollutantCard name="Temp" value={fullSensors.temp} unit="°C" trend="stable" history={historyData.map(i => ({ val: 24.5 + Math.random() }))} color="#f43f5e" chartTokens={currentTheme.chartTokens} />
            <PollutantCard name="Humid" value={fullSensors.humidity} unit="%" trend="stable" history={historyData.map(i => ({ val: 45 + Math.random()*2 }))} color="#06b6d4" chartTokens={currentTheme.chartTokens} />
          </div>
        </div>

        {/* ── Map & Trends Row ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Hyperlocal Map Preview */}
          <div className="lg:col-span-5 bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col relative overflow-hidden min-h-[400px]">
             <div className="flex items-center justify-between z-10 relative mb-4">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center space-x-2">
                 <MapIcon size={16} className="text-sky-400" />
                 <span>Hyperlocal Grid</span>
               </h3>
               <button onClick={() => navigate('/map')} className="text-[10px] font-bold uppercase tracking-widest text-sky-400 hover:text-white flex items-center space-x-1">
                 <span>Full Map</span>
                 <Maximize2 size={12} />
               </button>
             </div>
             
             <div className="absolute inset-0 top-16 rounded-b-[2.5rem] overflow-hidden opacity-80 border-t border-white/5">
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', background: '#0B0F1A' }} zoomControl={false} dragging={false}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  {sectors?.map((s, i) => (
                    <CircleMarker key={i} center={[mapCenter[0] + (Math.random()-0.5)*0.05, mapCenter[1] + (Math.random()-0.5)*0.05]} radius={s.aqi > 100 ? 12 : 8}
                       pathOptions={{ color: s.aqi > 100 ? '#f97316' : '#10b981', fillColor: s.aqi > 100 ? '#f97316' : '#10b981', fillOpacity: 0.6 }}
                    />
                  ))}
                </MapContainer>
                {/* Overlay Vignette */}
                <div className="absolute inset-0 shadow-2xl pointer-events-none z-400" />
             </div>
          </div>

          {/* Trend Charts */}
          <div className="lg:col-span-7 bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
             <div className="flex items-center justify-between mb-8">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center space-x-2">
                 <TrendingUp size={16} className="text-sky-400" />
                 <span>Risk Architecture Forecast</span>
               </h3>
               <div className="flex space-x-2 bg-white/5 p-1 rounded-xl">
                 <button onClick={() => setTrendRange('24h')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${trendRange === '24h' ? 'bg-[#0B0F1A] text-sky-400 shadow-md' : 'text-slate-500 hover:text-white'}`}>24H</button>
                 <button onClick={() => setTrendRange('7d')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${trendRange === '7d' ? 'bg-[#0B0F1A] text-sky-400 shadow-md' : 'text-slate-500 hover:text-white'}`}>7D</button>
               </div>
             </div>
             
              <motion.div 
                key={currentTheme.mode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
                className="h-[260px] w-full relative"
              >
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={trendData}>
                     <defs>
                       <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor={currentTheme.chartTokens.line} stopOpacity={0.4}/>
                         <stop offset="95%" stopColor={currentTheme.chartTokens.line} stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="chartGlowDanger" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                         <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke={currentTheme.chartTokens.grid} vertical={false} />
                     <XAxis dataKey="time" stroke={currentTheme.chartTokens.text} fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
                     <YAxis stroke={currentTheme.chartTokens.text} fontSize={10} axisLine={false} tickLine={false} />
                     <Tooltip contentStyle={{ backgroundColor: 'rgba(11, 15, 26, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }} itemStyle={{ fontSize: 12, fontWeight: 700 }} />
                     <Area type="monotone" dataKey="aqi" stroke={currentTheme.chartTokens.line} fillOpacity={1} fill="url(#chartGlow)" strokeWidth={currentTheme.chartTokens.thickness} strokeDasharray={d => d.isForecast ? "6 6" : "0"} isAnimationActive={false}/>
                     <Area type="monotone" dataKey="rri" stroke="#f43f5e" fillOpacity={1} fill="url(#chartGlowDanger)" strokeWidth={2} strokeDasharray={d => d.isForecast ? "6 6" : "0"} isAnimationActive={false}/>
                   </AreaChart>
                 </ResponsiveContainer>
              </motion.div>
          </div>
        </div>

        {/* ── Sectors, Sensitive Groups, Network Row ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Sensitive Groups Panel */}
          <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center space-x-2 mb-6">
              <Shield size={16} className="text-orange-400" />
              <span>Vulnerable Profiles</span>
            </h3>
            <div className="space-y-4">
              {groupRisks.map(group => {
                const effectiveRri = Math.min(100, (derived.rri || 0) * group.multiplier);
                const color = effectiveRri > 70 ? '#ef4444' : effectiveRri > 50 ? '#f97316' : '#10b981';
                return (
                  <div key={group.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden group hover:bg-white/10 transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }} />
                    <div className="flex items-center justify-between relative z-10 pl-2">
                       <div className="flex items-center space-x-3">
                         <div className="p-2 bg-[#0B0F1A] rounded-xl"><group.icon size={14} className="text-slate-400" /></div>
                         <span className="text-sm font-bold text-slate-200">{group.label}</span>
                       </div>
                       <div className="text-right">
                         <span className="text-lg font-black" style={{ color }}>{Math.round(effectiveRri)}</span>
                         <span className="text-[9px] font-black uppercase text-slate-500 block">Eff. RRI</span>
                       </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Location Comparison Cards */}
          <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
             <div className="flex items-center justify-between mb-6">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center space-x-2">
                 <Crosshair size={16} className="text-emerald-400" />
                 <span>Sector Comparison</span>
               </h3>
             </div>
             <div className="space-y-4">
                {sectors?.slice(0, 3).map(sector => (
                  <div key={sector.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer">
                    <div>
                      <h4 className="font-bold text-white mb-1">{sector.name}</h4>
                      <div className="flex space-x-3 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                        <span>Dist: {Math.floor(Math.random()*10)}km</span>
                        <span className="text-emerald-400">Online</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="text-xl font-black text-white">{sector.aqi}</span>
                        <span className="text-[9px] font-black uppercase text-slate-500 block">AQI</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-600" />
                    </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Network & Quick Actions */}
          <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
             <div>
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center space-x-2 mb-6">
                 <Network size={16} className="text-sky-400" />
                 <span>Network Status</span>
               </h3>
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <span className="text-3xl font-black text-white">{nodes?.filter(n => n.status === 'active' || n.status === 'online')?.length || 0}</span>
                   <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest block">Active Nodes</span>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <span className="text-3xl font-black text-white">{nodes?.filter(n => n.status !== 'active' && n.status !== 'online')?.length || 0}</span>
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Offline</span>
                 </div>
               </div>
             </div>

             <div className="space-y-3 pt-6 border-t border-white/5">
               <button onClick={() => navigate('/pollutants')} className="w-full py-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl font-bold text-xs uppercase tracking-widest border border-sky-500/20 transition-colors">
                 Deep Analytics
               </button>
               <button onClick={() => navigate('/profile')} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-widest border border-white/5 transition-colors">
                 Edit Health Profile
               </button>
             </div>
          </div>

        </div>

      </main>
    </div>
  );
};

export default Dashboard;
