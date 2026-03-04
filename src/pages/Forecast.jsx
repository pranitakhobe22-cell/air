import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, Target, AlertTriangle, Wind, Zap, Activity, CalendarDays } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine 
} from 'recharts';
import useAerisStore from '@/store/aerisStore';
import { getAtmosphereTheme } from '@/utils/atmosphereTheme';

// Dummy historical vs prediction generating logic based on selection
const generateData = (days) => {
  const data = [];
  const now = new Date();
  
  // Historical data points
  for(let i = days; i > 0; i--) {
    data.push({
      time: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      actualRri: Math.floor(40 + Math.random() * 40),
      type: 'history'
    });
  }
  
  // Current pivot point
  const currentRri = data[data.length - 1]?.actualRri || 50;
  
  // Projected data points
  data.push({ 
    time: 'Now', 
    actualRri: currentRri,
    predictedRri: currentRri, 
    type: 'pivot' 
  });
  
  for(let i = 1; i <= days; i++) {
    // Generate trending curve
    const trend = Math.sin(i / 2) * 20;
    data.push({
      time: new Date(now.getTime() + i * 24 * 60 * 60 * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      predictedRri: Math.max(10, Math.floor(currentRri + trend + (Math.random() * 10 - 5))),
      type: 'forecast'
    });
  }
  return data;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const isForecast = payload[0].dataKey === 'predictedRri';
    return (
      <div className="bg-[#050B14]/95 border border-white/10 p-3 rounded-2xl shadow-2xl backdrop-blur-xl">
        <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">{label}</p>
        <p className="text-xl font-black flex items-center space-x-2" style={{ color: isForecast ? '#38bdf8' : '#34d399' }}>
           <span>{payload[0].value}</span>
           <span className="text-[10px] uppercase tracking-widest text-slate-500">RRI</span>
        </p>
        <p className="text-xs font-bold mt-1 text-slate-400">
          {isForecast ? 'AI Prediction' : 'Historical Record'}
        </p>
      </div>
    );
  }
  return null;
};

const Forecast = () => {
  const { data, fetchLatest } = useAerisStore();
  const [timeframe, setTimeframe] = useState('7d'); // 24h, 7d, 30d
  const [chartData, setChartData] = useState([]);

  const currentTheme = getAtmosphereTheme(data?.derived?.aqi || 0, data?.derived?.risk_level);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    // Simulate generation based on toggle
    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
    setChartData(generateData(days));
  }, [timeframe]);

  if (!data?.forecast) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Derive metrics from chart data
  const forecastedData = chartData.filter(d => d.predictedRri);
  const peakRri = Math.max(...forecastedData.map(d => d.predictedRri));
  const peakItem = forecastedData.find(d => d.predictedRri === peakRri);
  const avgRri = Math.floor(forecastedData.reduce((acc, curr) => acc + curr.predictedRri, 0) / forecastedData.length);
  const aiConfidence = timeframe === '24h' ? 94 : timeframe === '7d' ? 82 : 65;

  return (
    <div className="p-8 pb-32 max-w-[1600px] mx-auto space-y-8 text-slate-100 selection:bg-sky-500/30">
      
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Target size={24} className="text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)]" />
            <h1 className="text-3xl font-black tracking-tight">AI Forecast Intelligence</h1>
          </div>
          <p className="text-slate-400 font-medium">Predictive modeling of future environmental threat vectors.</p>
        </div>
        <div className="px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-full flex items-center space-x-2">
           <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shadow-[0_0_8px_#38bdf8]" />
           <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">Neural Net Linked</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ── Main Chart Section ───────────────────────────── */}
        <div className="lg:col-span-8 space-y-8">
          
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 relative z-10">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center space-x-2">
                 <Activity size={14} className="text-sky-500" />
                 <span>Predictive Trajectory</span>
              </h3>
              
              {/* Timing Toggles */}
              <div className="flex bg-[#0B0F1A] border border-white/10 rounded-xl p-1 mt-4 md:mt-0">
                {['24h', '7d', '30d'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                      timeframe === t 
                        ? 'bg-sky-500/20 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.2)]' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Area */}
            <motion.div 
               key={`${timeframe}-${currentTheme.mode}`}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ duration: 0.8 }}
               className="h-[400px] relative z-10 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={currentTheme.chartTokens.line} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={currentTheme.chartTokens.line} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" stroke={currentTheme.chartTokens.grid} vertical={false} />
                  <XAxis dataKey="time" stroke={currentTheme.chartTokens.text} fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke={currentTheme.chartTokens.text} fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2, strokeDasharray: '4 4' }} />
                  
                  <ReferenceLine x="Now" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" label={{ position: 'top', value: 'CURRENT TIME', fill: '#64748b', fontSize: 10, fontWeight: 900, tracking: '0.2em' }} />

                  {/* Historical Data */}
                  <Area 
                     type="monotone" 
                     dataKey="actualRri" 
                     stroke="#34d399" 
                     strokeWidth={3}
                     fillOpacity={1} 
                     fill="url(#colorActual)" 
                     isAnimationActive={false}
                  />
                  {/* Predicted Data */}
                  <Area 
                     type="monotone" 
                     dataKey="predictedRri" 
                     stroke={currentTheme.chartTokens.line} 
                     strokeWidth={currentTheme.chartTokens.thickness}
                     strokeDasharray="8 6"
                     fillOpacity={1} 
                     fill="url(#colorPredicted)" 
                     isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
            
            {/* Chart Legend */}
            <div className="flex justify-center items-center space-x-8 mt-6">
               <div className="flex items-center space-x-2">
                  <div className="w-3 h-1 bg-emerald-400 rounded-full" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recorded History</span>
               </div>
               <div className="flex items-center space-x-2">
                  <div className="w-3 h-1 border-t-2 border-dashed border-sky-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Neural Forecast</span>
               </div>
            </div>

          </div>

          {/* ── Summary Metrics Cards ───────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Predicted Peak RRI', value: peakRri, color: peakRri > 75 ? 'text-red-400' : 'text-amber-400', sub: 'Maximum risk vector' },
              { label: 'Average Median RRI', value: avgRri, color: 'text-sky-400', sub: 'Baseline projection' },
              { label: 'Estimated Peak Time', value: peakItem?.time || 'Unknown', color: 'text-white', sub: 'Highest threat window' },
              { label: 'Forecast Confidence', value: `${aiConfidence}%`, color: 'text-emerald-400', sub: 'Neural net accuracy' },
            ].map((metric, i) => (
               <div key={i} className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 hover:bg-white/5 transition-colors duration-300 rounded-2xl p-6 relative overflow-hidden group">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">{metric.label}</h4>
                  <div className={`text-3xl font-black ${metric.color}`}>{metric.value}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-600 tracking-widest mt-2">{metric.sub}</div>
               </div>
            ))}
          </div>

        </div>

        {/* ── Right Column ─────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Risk Window Timelines */}
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl">
             <div className="flex items-center space-x-3 mb-8">
                <CalendarDays size={18} className="text-slate-400" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Risk Timeline Analysis</h3>
             </div>
             
             <div className="space-y-6">
               {[
                 { label: 'Safe Operations', percent: 45, color: '#10b981' },
                 { label: 'Elevated Risk Window', percent: 35, color: '#f59e0b' },
                 { label: 'Danger Territory', percent: 20, color: '#ef4444' },
               ].map((window, i) => (
                 <div key={i}>
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-bold uppercase tracking-widest text-slate-300">{window.label}</span>
                       <span className="text-xs font-mono font-bold" style={{ color: window.color }}>{window.percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${window.percent}%` }}
                         transition={{ duration: 1.5, delay: i * 0.2 }}
                         className="h-full rounded-full"
                         style={{ backgroundColor: window.color, boxShadow: `0 0 10px ${window.color}80` }}
                       />
                    </div>
                 </div>
               ))}
             </div>
          </div>

          {/* Toxic Event Probability */}
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
             <div className="absolute -bottom-10 -right-10 opacity-10 blur-xl group-hover:opacity-20 transition-all duration-500">
               <AlertTriangle size={150} className="text-pink-500" />
             </div>
             
             <div className="relative z-10">
               <div className="flex items-center space-x-3 mb-8">
                  <Zap size={18} className="text-pink-500 shadow-[0_0_10px_#ec4899]" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Toxic Event Probability</h3>
               </div>

               <div className="space-y-4">
                 {[
                   { event: 'Dust Storm Influx', prob: '12%', icon: Wind, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                   { event: 'Traffic Gridlock Peak', prob: '84%', icon: Activity, color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
                   { event: 'Industrial Emission Spike', prob: '43%', icon: AlertTriangle, color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
                 ].map((event, i) => (
                   <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border ${event.bg} ${event.border}`}>
                     <div className="flex items-center space-x-4">
                       <div className="p-2 bg-black/40 rounded-xl">
                          <event.icon size={16} className={event.color} />
                       </div>
                       <span className="text-xs font-bold text-white tracking-wide">{event.event}</span>
                     </div>
                     <span className={`text-lg font-black ${event.color}`}>{event.prob}</span>
                   </div>
                 ))}
               </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Forecast;
