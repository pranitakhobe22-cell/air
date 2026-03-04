import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Wind, AlertTriangle, TrendingUp, TrendingDown, 
  Minus, Activity, ThermometerSun, Droplets, 
  CloudFog, Gauge, ArrowRight 
} from 'lucide-react';
import { 
  AreaChart, Area, ResponsiveContainer, XAxis, Tooltip 
} from 'recharts';
import useAerisStore from '@/store/aerisStore';
import { getAtmosphereTheme } from '@/utils/atmosphereTheme';

// Pollutant definitions mapping with intelligence data
const POLLUTANT_CONFIG = {
  pm25: { 
    label: 'PM2.5', unit: 'µg/m³', safe: 12, moderate: 35, danger: 55, 
    color: '#38bdf8', weight: 0.4, 
    desc: 'Fine particulate matter. Penetrates deep into the alveolar region of the lungs.',
    impact: 'Elevated cardiovascular stress; acute respiratory irritation.'
  },
  pm10: { 
    label: 'PM10', unit: 'µg/m³', safe: 54, moderate: 154, danger: 254, 
    color: '#818cf8', weight: 0.2, 
    desc: 'Coarse dust particles originating from construction and roadways.',
    impact: 'Upper respiratory tract inflammation; aggravates existing asthma.'
  },
  o3: { 
    label: 'Ozone (O₃)', unit: 'ppb', safe: 54, moderate: 70, danger: 85, 
    color: '#34d399', weight: 0.15, 
    desc: 'Ground-level reactive gas formed by sunlight interacting with emissions.',
    impact: 'Damages lung tissue; reduces overall pulmonary function.'
  },
  no2: { 
    label: 'Nitrogen Dioxide', unit: 'ppb', safe: 53, moderate: 100, danger: 360, 
    color: '#fbbf24', weight: 0.1, 
    desc: 'Highly reactive gas primarily from vehicle exhaust systems.',
    impact: 'Increases susceptibility to respiratory infections.'
  },
  co: { 
    label: 'Carbon Monoxide', unit: 'ppm', safe: 4.4, moderate: 9.4, danger: 12.4, 
    color: '#f472b6', weight: 0.1, 
    desc: 'Odorless, colorless toxic gas from incomplete combustion.',
    impact: 'Reduces oxygen delivery to the body\'s organs and tissues.'
  },
  voc: { 
    label: 'VOCs', unit: 'ppb', safe: 250, moderate: 500, danger: 1000, 
    color: '#a78bfa', weight: 0.05, 
    desc: 'Volatile Organic Compounds emitted as gases from solids/liquids.',
    impact: 'Eye, nose irritation; prolonged exposure may be carcinogenic.'
  },
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#050B14]/95 border border-white/10 p-2 rounded-xl shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-black" style={{ color: payload[0].stroke }}>
           {Number(payload[0].value).toFixed(1)} <span className="text-[9px] uppercase tracking-widest text-slate-500">Recorded</span>
        </p>
      </div>
    );
  }
  return null;
};

const Pollutants = () => {
  const { data, fetchLatest } = useAerisStore();

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  if (!data?.sensors) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { sensors, environment, history, derived } = data;
  const historyData = Array.isArray(history) ? history.slice(-20) : [];
  const currentTheme = getAtmosphereTheme(derived.aqi, derived.risk_level);

  // Determine actual trend arrow
  const getTrendIcon = (key, currentVal) => {
    if (historyData.length < 2) return <Minus size={14} className="text-slate-500" />;
    const prevVal = historyData[historyData.length - 2]?.[key] || currentVal;
    if (currentVal > prevVal * 1.05) return <TrendingUp size={14} className="text-rose-500" />;
    if (currentVal < prevVal * 0.95) return <TrendingDown size={14} className="text-emerald-500" />;
    return <Minus size={14} className="text-slate-500" />;
  };

  return (
    <div className="p-8 pb-32 max-w-[1600px] mx-auto space-y-8 text-slate-100 selection:bg-sky-500/30">
      
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Activity size={24} className="text-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
            <h1 className="text-3xl font-black tracking-tight">Pollutant Analysis</h1>
          </div>
          <p className="text-slate-400 font-medium">Deep-dive sensory breakdown and individual toxicological impacts.</p>
        </div>
        <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center space-x-2">
           <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_#818cf8]" />
           <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Sensory Array Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* ── Left Column: 6 Core Pollutant Cards ──────────── */}
        <div className="xl:col-span-9 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(POLLUTANT_CONFIG).map(([key, config], idx) => {
            // Map the store keys to config keys
            const valKey = key === 'no2' ? 'nox' : key; 
            const value = sensors?.[valKey] || 0;
            
            // Risk Calculations
            const fillRatio = Math.min((value / config.danger) * 100, 100);
            const aqiContribution = Math.round((config.weight * (value / config.safe)) * 100);
            const isDanger = value >= config.danger;
            const isWarning = value >= config.moderate && value < config.danger;
            
            // Styling based on risk
            const cardBorder = isDanger ? 'border-rose-500/50' : isWarning ? 'border-amber-500/30' : 'border-white/5';
            const cardBg = isDanger ? 'bg-rose-950/20' : isWarning ? 'bg-amber-950/10' : 'bg-[#111827]/60';
            const glowColor = isDanger ? '#e11d48' : isWarning ? '#d97706' : config.color;

            // Chart array mapping
            const sparkData = historyData.map(h => ({
              time: h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
              value: h[valKey] || value
            }));

            return (
              <motion.div 
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`backdrop-blur-2xl border rounded-3xl p-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-xl ${cardBg} ${cardBorder}`}
              >
                 <div className="absolute -top-10 -right-10 w-32 h-32 blur-[50px] opacity-20 pointer-events-none transition-all group-hover:opacity-40" style={{ backgroundColor: glowColor }} />
                 
                 <div className="relative z-10 flex flex-col h-full">
                    {/* Top Row */}
                    <div className="flex justify-between items-start mb-4">
                       <div>
                         <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{config.label}</h3>
                         <div className="flex items-center space-x-2 mt-1">
                            {isDanger ? (
                              <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-sm">Critical DANGER</span>
                            ) : isWarning ? (
                              <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-sm">Elevated Risk</span>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-sm">Safe Baseline</span>
                            )}
                         </div>
                       </div>
                       <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center">
                          {getTrendIcon(valKey, value)}
                       </div>
                    </div>

                    {/* Value readout */}
                    <div className="flex items-baseline space-x-2 mb-6">
                       <span className="text-4xl font-black tracking-tighter" style={{ color: glowColor }}>
                         {Number(value).toFixed(1)}
                       </span>
                       <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{config.unit}</span>
                    </div>

                    {/* Risk Progress Bar */}
                    <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden mb-2">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${fillRatio}%` }}
                         transition={{ duration: 1.5, ease: "easeOut" }}
                         className="h-full rounded-full"
                         style={{ backgroundColor: glowColor, boxShadow: `0 0 10px ${glowColor}80` }}
                       />
                    </div>
                    <div className="flex justify-between items-center mb-6">
                       <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">0</span>
                       <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 border-x border-slate-700 px-1">Safe {config.safe}</span>
                       <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 border-x border-slate-700 px-1">Mod. {config.moderate}</span>
                       <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500">Dngr {config.danger}</span>
                    </div>

                    {/* AQI Contribution */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B0F1A]/80 border border-white/5 mb-6">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AQI Contribution Factor</span>
                       <span className="text-sm font-black text-white">{aqiContribution}%</span>
                    </div>

                    {/* Sparkline Space */}
                    <motion.div 
                      key={currentTheme.mode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8 }}
                      className="h-16 mb-4 -mx-2"
                    >
                       <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={sparkData}>
                             <defs>
                               <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor={glowColor} stopOpacity={0.3}/>
                                 <stop offset="95%" stopColor={glowColor} stopOpacity={0}/>
                               </linearGradient>
                             </defs>
                             <Tooltip content={<CustomTooltip />} cursor={false} />
                             <Area 
                               type="monotone" 
                               dataKey="value" 
                               stroke={currentTheme.mode === 'clean' || currentTheme.mode === 'moderate' ? glowColor : currentTheme.chartTokens.line} 
                               strokeWidth={currentTheme.chartTokens.thickness - 1} 
                               fill={`url(#grad-${key})`} 
                               isAnimationActive={false} 
                             />
                          </AreaChart>
                       </ResponsiveContainer>
                    </motion.div>

                    {/* Text Blocks */}
                    <div className="mt-auto space-y-3 pt-4 border-t border-white/5">
                       <div>
                         <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1">Source Agent</span>
                         <p className="text-xs font-medium text-slate-300 leading-snug">{config.desc}</p>
                       </div>
                       <div>
                         <span className="text-[9px] font-black uppercase tracking-widest text-rose-900/50 block mb-1" style={{ color: `${glowColor}80`}}>Health Impact</span>
                         <p className="text-xs font-bold leading-snug" style={{ color: glowColor }}>{config.impact}</p>
                       </div>
                    </div>

                 </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Right Column: Environmental Context ──────────── */}
        <div className="xl:col-span-3 space-y-6">
          
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden group h-full flex flex-col">
             <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-sky-500/10 blur-[80px] rounded-full pointer-events-none" />
             
             <div className="flex items-center space-x-3 mb-8 relative z-10">
                <CloudFog size={20} className="text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Atmospheric Context</h3>
             </div>
             
             <p className="text-xs font-medium text-slate-400 mb-8 relative z-10 leading-relaxed max-w-[250px]">
               Environmental metrics heavily influence pollutant dispersion, suspension rates, and biological impact severity.
             </p>

             <div className="space-y-4 relative z-10 flex-1">
                {/* Temp */}
                <div className="p-5 rounded-2xl bg-[#0B0F1A] border border-white/5 flex items-center justify-between group-hover:border-white/10 transition-colors">
                   <div className="flex items-center space-x-4">
                     <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400">
                        <ThermometerSun size={18} />
                     </div>
                     <span className="text-xs font-black uppercase tracking-widest text-slate-300">Temperature</span>
                   </div>
                   <div className="text-xl font-black text-white">{Number(environment?.temperature || 0).toFixed(1)}<span className="text-[10px] text-slate-500 ml-1">°C</span></div>
                </div>

                {/* Humidity */}
                <div className="p-5 rounded-2xl bg-[#0B0F1A] border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                   <div className="flex items-center space-x-4">
                     <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                        <Droplets size={18} />
                     </div>
                     <span className="text-xs font-black uppercase tracking-widest text-slate-300">Humidity</span>
                   </div>
                   <div className="text-xl font-black text-white">{Number(environment?.humidity || 0).toFixed(1)}<span className="text-[10px] text-slate-500 ml-1">%</span></div>
                </div>

                {/* Local Pressure */}
                <div className="p-5 rounded-2xl bg-[#0B0F1A] border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                   <div className="flex items-center space-x-4">
                     <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                        <Gauge size={18} />
                     </div>
                     <span className="text-xs font-black uppercase tracking-widest text-slate-300">Pressure</span>
                   </div>
                   <div className="text-xl font-black text-white">{Math.floor(environment?.pressure || 0)}<span className="text-[10px] text-slate-500 ml-1">hPa</span></div>
                </div>

                {/* O2 Conc */}
                <div className="p-5 rounded-2xl bg-[#0B0F1A] border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                   <div className="flex items-center space-x-4">
                     <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                        <Wind size={18} />
                     </div>
                     <span className="text-xs font-black uppercase tracking-widest text-slate-300">Oxygen Conc.</span>
                   </div>
                   <div className="text-xl font-black text-white">{Number(environment?.oxygen || 0).toFixed(1)}<span className="text-[10px] text-slate-500 ml-1">%</span></div>
                </div>
             </div>
             
             {/* RRI Sync note */}
             <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Engine Feedback</span>
                <span className="text-emerald-500 flex items-center space-x-1"><Activity size={12}/> <span className="text-[10px] font-bold uppercase tracking-widest">Synced</span></span>
             </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Pollutants;
