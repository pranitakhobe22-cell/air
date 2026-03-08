import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wind, Droplets, Thermometer, AlertTriangle, X,
  TrendingUp, TrendingDown, Minus, MapPin, ChevronRight,
  Activity, Clock, Eye, Heart, ArrowUpRight, Gauge
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import useAerisStore from '@/store/aerisStore';
import useAuthStore from '@/store/useAuthStore';
import useActiveNode from '@/hooks/useActiveNode';

const AnimatedNumber = ({ value, decimals = 0 }) => {
  const [display, setDisplay] = useState(value || 0);
  const prev = useRef(value || 0);
  useEffect(() => {
    if (value === undefined || value === null) return;
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

const getAqiBand = (aqi) => {
  if (aqi <= 50) return { label: 'Good', color: '#22c55e', bg: 'bg-emerald-500/10', text: 'text-emerald-400', advice: 'Air quality is satisfactory. Enjoy outdoor activities.' };
  if (aqi <= 100) return { label: 'Moderate', color: '#eab308', bg: 'bg-yellow-500/10', text: 'text-yellow-400', advice: 'Acceptable air quality. Sensitive individuals should limit prolonged outdoor exertion.' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#f97316', bg: 'bg-orange-500/10', text: 'text-orange-400', advice: 'People with respiratory conditions should reduce outdoor activity.' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444', bg: 'bg-red-500/10', text: 'text-red-400', advice: 'Everyone may begin to experience health effects. Limit outdoor exposure.' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#a855f7', bg: 'bg-purple-500/10', text: 'text-purple-400', advice: 'Health alert: everyone may experience serious health effects.' };
  return { label: 'Hazardous', color: '#991b1b', bg: 'bg-red-900/20', text: 'text-red-300', advice: 'Emergency conditions. Avoid all outdoor activity.' };
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const valid = payload.filter((p) => p.value != null && !isNaN(p.value));
  if (valid.length === 0) return null;
  return (
    <div className="bg-[#0c1322] rounded-xl px-3.5 py-2.5 shadow-xl shadow-black/40">
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      {valid.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {Math.round(p.value)}
        </p>
      ))}
    </div>
  );
};

const MetricCard = ({ label, value, unit, icon: Icon, color, sparkData = [], decimals = 0 }) => (
  <div className="bg-white/[0.03] rounded-2xl p-4 flex flex-col group hover:bg-white/[0.05] transition-colors duration-300">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}10` }}>
          <Icon size={13} style={{ color }} />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
    </div>
    <div className="flex items-baseline gap-1.5 mb-3">
      <span className="text-2xl font-bold text-white tabular-nums"><AnimatedNumber value={value} decimals={decimals} /></span>
      <span className="text-[11px] text-slate-600">{unit}</span>
    </div>
    {sparkData.length > 1 && (
      <div className="h-8 -mx-1 mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#g-${label})`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { data } = useAerisStore();
  const user = useAuthStore((s) => s.user);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const active = useActiveNode();

  if (!data?.sensors || !data?.derived) {
    return (
      <div className="p-5 sm:p-8 lg:p-10 max-w-[1440px] mx-auto space-y-6">
        <div>
          <div className="h-7 w-52 bg-white/[0.04] rounded-xl animate-pulse" />
          <div className="h-4 w-36 bg-white/[0.03] rounded-lg mt-3 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white/[0.03] rounded-2xl h-56 animate-pulse" />
          <div className="lg:col-span-3 bg-white/[0.03] rounded-2xl h-56 animate-pulse" />
          <div className="lg:col-span-5 bg-white/[0.03] rounded-2xl h-56 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white/[0.03] rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { sectors, alerts, nodes, meta, perNode } = data;
  const espNodes = perNode ? Object.entries(perNode) : [];

  const sensors = active.sensors || data.sensors;
  const derived = active.derived || data.derived;
  const environment = active.environment || data.environment;
  const aqi = derived.aqi || 0;
  const rri = derived.rri || 0;
  const band = getAqiBand(aqi);
  const historyData = Array.isArray(active.history) ? active.history.slice(-30) : [];

  const trendData = historyData.map((h, i) => ({
    time: h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${i}`,
    AQI: h.aqi || 0,
    RRI: h.rri || 0,
  }));

  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? 'Good morning' : greetHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-[1440px] mx-auto space-y-6 sm:space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{greeting}, {user?.name?.split(' ')[0] || 'there'}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <MapPin size={13} className="text-slate-600" />
            <span className="text-sm text-slate-500">{active.nodeName || meta?.location || 'Live Sector'}</span>
            <span className="text-slate-700 mx-0.5 hidden sm:inline">&middot;</span>
            <span className="text-sm text-slate-500 hidden sm:block">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate('/pollutants')} className="px-4 py-2 text-xs font-medium text-slate-400 bg-white/[0.04] rounded-xl hover:bg-white/[0.07] transition-colors">
            Pollutants
          </button>
          <button onClick={() => navigate('/live')} className="px-4 py-2 text-xs font-medium text-sky-400 bg-sky-500/10 rounded-xl hover:bg-sky-500/15 transition-colors">
            Live Monitor
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <AnimatePresence>
        {alerts?.length > 0 && !alertDismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-red-500/[0.06] rounded-2xl px-5 py-3.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-200/90">{alerts[0].message}</p>
            </div>
            <button onClick={() => setAlertDismissed(true)} className="p-1 hover:bg-white/5 rounded-lg shrink-0">
              <X size={14} className="text-slate-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rain Banner */}
      {environment?.rain && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-sky-500/[0.06] rounded-2xl px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Droplets size={18} className="text-sky-400" />
            <div>
              <span className="text-sm font-medium text-sky-300">Rain Detected</span>
              {(environment.pm25RainDelta || 0) > 0 && (
                <span className="block text-xs text-sky-400/70 mt-0.5">
                  PM2.5 reduced by {Number(environment.pm25RainDelta).toFixed(1)} µg/m³ due to rain washout
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-sky-500 font-medium">Live</span>
        </motion.div>
      )}

      {/* AQI Hero + RRI + Advisory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* AQI Card */}
        <div className="lg:col-span-4 bg-white/[0.03] rounded-2xl p-6 flex flex-col">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-4">Air Quality Index</span>
          <div className="flex items-end gap-3 mb-3">
            <span className="text-6xl sm:text-7xl font-extrabold tabular-nums leading-none" style={{ color: band.color }}>
              <AnimatedNumber value={aqi} />
            </span>
            <span className="text-lg font-medium text-slate-600 mb-2">/ 500</span>
          </div>
          <div className={`inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${band.bg} ${band.text} mb-5`}>
            {band.label}
          </div>
          <div className="mt-auto">
            <div className="h-1.5 rounded-full overflow-hidden flex gap-0.5">
              <div className="flex-1 bg-emerald-500 rounded-full" />
              <div className="flex-1 bg-yellow-500 rounded-full" />
              <div className="flex-1 bg-orange-500 rounded-full" />
              <div className="flex-1 bg-red-500 rounded-full" />
              <div className="flex-1 bg-purple-500 rounded-full" />
              <div className="flex-1 bg-red-900 rounded-full" />
            </div>
            <div className="relative h-3">
              <div className="absolute top-0 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-transparent border-b-white transition-all duration-700"
                style={{ left: `${Math.min(aqi / 500 * 100, 100)}%`, transform: 'translateX(-50%)' }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-700 mt-0.5">
              <span>0</span><span>100</span><span>200</span><span>300</span><span>500</span>
            </div>
          </div>
        </div>

        {/* RRI + Environment */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-white/[0.03] rounded-2xl p-5 flex-1 flex flex-col items-center justify-center">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-4">Risk Index</span>
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
                <motion.circle cx="60" cy="60" r="52" fill="none" strokeWidth="7"
                  strokeDasharray={327} initial={{ strokeDashoffset: 327 }}
                  animate={{ strokeDashoffset: 327 - (327 * Math.min(rri, 100) / 100) }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  stroke={band.color} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white tabular-nums"><AnimatedNumber value={rri} /></span>
                <span className="text-[10px] text-slate-600 uppercase tracking-widest">RRI</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] rounded-2xl p-4 text-center">
              <Thermometer size={15} className="text-orange-400 mx-auto mb-1.5" />
              <span className="text-lg font-semibold text-white tabular-nums">{Number(environment?.temperature || 0).toFixed(1)}°</span>
              <span className="block text-[10px] text-slate-600 mt-0.5">Temp</span>
            </div>
            <div className="bg-white/[0.03] rounded-2xl p-4 text-center">
              <Droplets size={15} className="text-blue-400 mx-auto mb-1.5" />
              <span className="text-lg font-semibold text-white tabular-nums">{Number(environment?.humidity || 0).toFixed(0)}%</span>
              <span className="block text-[10px] text-slate-600 mt-0.5">Humidity</span>
            </div>
          </div>
        </div>

        {/* Health Advisory */}
        <div className="lg:col-span-5 bg-white/[0.03] rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Heart size={15} className="text-rose-400" />
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Health Advisory</span>
          </div>
          <p className="text-[15px] text-slate-300 leading-relaxed mb-5 flex-1">
            {band.advice}
          </p>
          <div className="space-y-3 pt-4 border-t border-white/[0.05]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Dominant pollutant</span>
              <span className="text-white font-medium">{derived.dominant || 'PM2.5'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Trend</span>
              <span className="flex items-center gap-1.5 text-white font-medium">
                {data.trend === 'rising' ? <><TrendingUp size={14} className="text-red-400" /> Rising</> : data.trend === 'falling' ? <><TrendingDown size={14} className="text-emerald-400" /> Falling</> : <><Minus size={14} className="text-slate-500" /> Stable</>}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Outdoor activity</span>
              <span className={`font-medium ${aqi > 100 ? 'text-orange-400' : 'text-emerald-400'}`}>
                {aqi > 150 ? 'Not recommended' : aqi > 100 ? 'Limit exposure' : 'Safe'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pollutant Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-400">Pollutant Readings</h2>
          <button onClick={() => navigate('/pollutants')} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors">
            Details <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          <MetricCard label="PM2.5" value={sensors.pm25} unit="µg/m³" icon={Wind} color="#ef4444" sparkData={historyData.map(h => ({ v: h.pm25 }))} />
          <MetricCard label="CO" value={sensors.co || 0} unit="ppm" icon={Activity} color="#eab308" decimals={2} sparkData={historyData.map(h => ({ v: h.co || 0 }))} />
          <MetricCard label="Ozone" value={sensors.o3} unit="ppb" icon={Eye} color="#06b6d4" sparkData={historyData.map(h => ({ v: h.o3 }))} />
          <MetricCard label="VOC" value={sensors.voc_index} unit="index" icon={Gauge} color="#8b5cf6" sparkData={historyData.map(h => ({ v: h.voc_index }))} />
          <MetricCard label="NOx" value={sensors.nox || 0} unit="ppb" icon={Activity} color="#ec4899" sparkData={historyData.map(h => ({ v: h.nox || 0 }))} />
        </div>
      </div>

      {/* Per-Node Graphs */}
      {espNodes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-4">Node Readings</h2>
          <div className={`grid gap-4 ${espNodes.length === 1 ? 'grid-cols-1 max-w-sm' : espNodes.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {espNodes.map(([nodeId, nd]) => {
              const nodeHistory = (nd.history || []).slice(-20);
              const nodeTrendData = nodeHistory.map((h, i) => ({
                time: h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${i}`,
                AQI: h.aqi || 0,
              }));
              const nodeAqi = nd.latest?.aqi || 0;
              const nodeBand = getAqiBand(nodeAqi);
              return (
                <div key={nodeId} className="bg-white/[0.03] rounded-2xl p-5 hover:bg-white/[0.05] transition-colors duration-300">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">{nodeId}</span>
                      <p className="text-sm font-medium text-slate-200 mt-0.5">{nd.location || nodeId}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold tabular-nums" style={{ color: nodeBand.color }}>{nodeAqi}</span>
                      <span className="block text-[10px] text-slate-600 uppercase">{nodeBand.label.split(' ')[0]}</span>
                    </div>
                  </div>
                  <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={nodeTrendData}>
                        <defs>
                          <linearGradient id={`nf-${nodeId}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={nodeBand.color} stopOpacity={0.15} />
                            <stop offset="100%" stopColor={nodeBand.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="AQI" stroke={nodeBand.color} strokeWidth={1.5} fill={`url(#nf-${nodeId})`} isAnimationActive={false} dot={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1 text-center pt-3 border-t border-white/[0.05]">
                    <div>
                      <span className="text-[9px] text-slate-600 block uppercase">PM2.5</span>
                      <span className="text-xs font-semibold text-slate-300">{nd.latest?.pm25 != null ? nd.latest.pm25.toFixed(1) : '--'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-600 block uppercase">CO</span>
                      <span className="text-xs font-semibold text-slate-300">{nd.latest?.co > 0 ? nd.latest.co.toFixed(2) : '--'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-600 block uppercase">NOx</span>
                      <span className="text-xs font-semibold text-slate-300">{nd.latest?.nox > 0 ? Math.round(nd.latest.nox) : '--'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-600 block uppercase">O3</span>
                      <span className="text-xs font-semibold text-slate-300">{nd.latest?.o3 != null ? nd.latest.o3.toFixed(1) : '--'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trend Chart + Stations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white/[0.03] rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-400">AQI & RRI Trend</h2>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded bg-sky-400 inline-block" /> AQI</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded bg-rose-400 inline-block" /> RRI</span>
            </div>
          </div>
          <div className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rriFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="time" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} width={35} domain={[0, 'auto']} allowDecimals={false} tickCount={5} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="AQI" stroke="#38bdf8" strokeWidth={2} fill="url(#aqiFill)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: '#38bdf8', stroke: '#060910', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="RRI" stroke="#fb7185" strokeWidth={1.5} fill="url(#rriFill)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: '#fb7185', stroke: '#060910', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-5">
          <div className="bg-white/[0.03] rounded-2xl p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400">Stations</h2>
              <span className="text-xs text-emerald-400 font-medium">{espNodes.length > 0 ? espNodes.length : nodes?.filter(n => n.status === 'active' || n.status === 'online')?.length || 0} online</span>
            </div>
            <div>
              {espNodes.length > 0 ? (
                espNodes.map(([nodeId, nd]) => (
                  <div key={nodeId} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <div>
                        <span className="text-sm text-slate-300">{nd.location || nodeId}</span>
                        <span className="block text-[10px] text-slate-600 font-mono">{nodeId}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums" style={{ color: getAqiBand(nd.latest?.aqi || 0).color }}>{nd.latest?.aqi || 0}</span>
                      <span className="text-[10px] text-slate-600 uppercase">{getAqiBand(nd.latest?.aqi || 0).label.split(' ')[0]}</span>
                    </div>
                  </div>
                ))
              ) : (
                sectors?.slice(0, 4).map(s => {
                  const sBand = getAqiBand(s.aqi);
                  return (
                    <div key={s.id} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.status === 'Safe' || s.status === 'active' ? '#22c55e' : '#f97316' }} />
                        <span className="text-sm text-slate-300">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums" style={{ color: sBand.color }}>{s.aqi}</span>
                        <span className="text-[10px] text-slate-600 uppercase">{sBand.label.split(' ')[0]}</span>
                      </div>
                    </div>
                  );
                })
              )}
              {espNodes.length === 0 && (!sectors || sectors.length === 0) && (
                <p className="text-sm text-slate-600 py-4 text-center">No stations reporting</p>
              )}
            </div>
            <button onClick={() => navigate('/network')} className="w-full mt-3 py-2.5 text-xs text-slate-500 hover:text-white bg-white/[0.03] rounded-xl hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1">
              All Stations <ChevronRight size={12} />
            </button>
          </div>

          <div className="bg-white/[0.03] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-400 mb-4">At-Risk Groups</h2>
            <div className="space-y-3">
              {[
                { label: 'Children', mult: 1.25 },
                { label: 'Elderly', mult: 1.35 },
                { label: 'Asthmatic', mult: 1.6 },
              ].map(g => {
                const eff = Math.min(100, Math.round(rri * g.mult));
                const c = eff > 70 ? '#ef4444' : eff > 45 ? '#f97316' : '#22c55e';
                return (
                  <div key={g.label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{g.label}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${eff}%`, backgroundColor: c }} />
                      </div>
                      <span className="text-sm font-semibold tabular-nums w-7 text-right" style={{ color: c }}>{eff}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
