import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Shield, Clock, HeartPulse, Wind, 
  Users, AlertTriangle, ChevronRight, Droplets 
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';

// ── Helpers ──────────────────────────────────────────────────
const rriToColor = (rri) => {
  if (rri >= 75) return '#ef4444'; // Red
  if (rri >= 55) return '#f97316'; // Orange
  if (rri >= 35) return '#f59e0b'; // Amber
  return '#10b981';                // Green
};

const CountUp = ({ end, duration = 1500, decimals = 0 }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (end === undefined || end === null) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(progress * end);
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);
  return <>{count.toFixed(decimals)}</>;
};

// Demographic Multipliers
const demographics = [
  { id: 'adult', label: 'Healthy Adult', multiplier: 1.0, icon: Users },
  { id: 'child', label: 'Children (Under 12)', multiplier: 1.3, icon: Users },
  { id: 'elderly', label: 'Elderly (65+)', multiplier: 1.4, icon: Users },
  { id: 'asthma', label: 'Asthmatics', multiplier: 1.8, icon: HeartPulse },
  { id: 'smoker', label: 'Smokers', multiplier: 1.5, icon: Wind },
];

const Exposure = () => {
  const { data, fetchLatest } = useAerisStore();
  const [selectedDuration, setSelectedDuration] = useState(1); // Hours: 1, 4, 8, 24
  const [activeDemographic, setActiveDemographic] = useState(demographics[0]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  if (!data?.derived) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const baseRri = data.derived.rri || 50;
  const pm25 = data.sensors?.pm25 || 35;
  
  // Calculate specific intelligence values
  const personalRri = Math.min(Math.floor(baseRri * activeDemographic.multiplier), 100);
  const orbColor = rriToColor(personalRri);
  
  // Formulas
  // Average human inhales 0.48 cubic meters of air per hour resting.
  // Particles inhaled = duration * 0.48 * pm25
  const inhaledParticles = selectedDuration * 0.48 * pm25;
  const healthImpactSeverity = personalRri * selectedDuration;

  let impactText = "Minimal physiological impact expected over this duration.";
  if (healthImpactSeverity > 500) impactText = "Critical particulate buildup. Immediate health effects likely (wheezing, cardiovascular stress).";
  else if (healthImpactSeverity > 250) impactText = "Significant exposure. Respiratory irritation highly probable in sensitive demographics.";
  else if (healthImpactSeverity > 100) impactText = "Moderate exposure. Prolonged outdoor activity not recommended without PPE.";

  return (
    <div className="p-8 pb-32 max-w-[1600px] mx-auto space-y-8 text-slate-100 selection:bg-sky-500/30">
      
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <HeartPulse size={24} className="text-pink-500 shadow-[0_0_15px_#ec4899]" />
            <h1 className="text-3xl font-black tracking-tight">Exposure Intelligence</h1>
          </div>
          <p className="text-slate-400 font-medium">Personalized physiological risk algorithms and dosage calculators.</p>
        </div>
        <div className="px-4 py-2 bg-pink-500/10 border border-pink-500/20 rounded-full flex items-center space-x-2">
           <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-widest text-pink-400">Biological Engine Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ── Left Column: Personal RRI Orb & Demographics ─── */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* RRI Orb */}
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl">
             <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />
             
             <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] relative z-10 w-full text-center">
                Effective Personal RRI
             </h3>

             <div className="relative mt-8 mb-4">
               {/* Glowing Background Rings */}
               <motion.div 
                 animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
                 transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                 className="absolute inset-0 rounded-full blur-2xl"
                 style={{ backgroundColor: orbColor }}
               />
               <div className="w-48 h-48 rounded-full border border-white/10 flex flex-col items-center justify-center relative z-10 bg-[#0B0F1A]/80 backdrop-blur-xl shadow-inner">
                  <span className="text-7xl font-black tracking-tighter" style={{ color: orbColor, textShadow: `0 0 30px ${orbColor}80` }}>
                    <CountUp end={personalRri} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">/ 100</span>
               </div>
               
               {/* Circular Progress SVG */}
               <svg className="absolute top-0 left-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <motion.circle 
                     cx="100" cy="100" r="90" fill="none" 
                     stroke={orbColor} strokeWidth="4"
                     strokeLinecap="round"
                     initial={{ strokeDasharray: "0 1000" }}
                     animate={{ strokeDasharray: `${(personalRri / 100) * 565} 1000` }}
                     transition={{ duration: 1.5, ease: "easeOut" }}
                  />
               </svg>
             </div>

             {/* Sensitive Badge Logic */}
             <div className="flex items-center space-x-2 mt-4 z-10 relative px-4 py-2 rounded-full border" style={{ backgroundColor: `${orbColor}15`, borderColor: `${orbColor}30` }}>
                <AlertTriangle size={14} style={{ color: orbColor }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: orbColor }}>
                   {activeDemographic.multiplier > 1.0 ? 'SENSITIVE GROUP MULTIPLIER' : 'STANDARD BASELINE'}
                </span>
             </div>
          </div>

          {/* Demographic Selector */}
          <div className="space-y-3">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 ml-2">Simulate Physiological Profile</h3>
             <div className="space-y-2">
                {demographics.map((demo) => {
                  const isActive = activeDemographic.id === demo.id;
                  const itemColor = isActive ? rriToColor(Math.min(baseRri * demo.multiplier, 100)) : '#64748b';
                  
                  return (
                    <button
                      key={demo.id}
                      onClick={() => setActiveDemographic(demo)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                        isActive 
                          ? 'bg-slate-800/80' 
                          : 'bg-[#111827]/40 border-white/5 hover:bg-white/5'
                      }`}
                      style={{ borderColor: isActive ? `${itemColor}50` : '' }}
                    >
                      <div className="flex items-center space-x-3">
                        <demo.icon size={18} style={{ color: itemColor }} className={isActive ? 'shadow-sm' : ''} />
                        <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                          {demo.label}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-24 h-1.5 bg-black/50 rounded-full overflow-hidden">
                           <motion.div 
                             className="h-full rounded-full"
                             style={{ backgroundColor: itemColor }}
                             initial={{ width: 0 }}
                             animate={{ width: `${(Math.min(baseRri * demo.multiplier, 100) / 100) * 100}%` }}
                           />
                        </div>
                        <span className="text-xs font-mono font-bold" style={{ color: itemColor }}>
                           x{demo.multiplier.toFixed(1)}
                        </span>
                      </div>
                    </button>
                  );
                })}
             </div>
          </div>

        </div>

        {/* ── Right Column: Duration Calculator ────────────── */}
        <div className="lg:col-span-8 space-y-8 flex flex-col">
           
           {/* Time Toggles */}
           <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center space-x-2">
                   <Clock size={16} /> <span>Exposure Duration Calculator</span>
                 </h3>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                {[1, 4, 8, 24].map((hours) => (
                   <button
                     key={hours}
                     onClick={() => setSelectedDuration(hours)}
                     className={`py-4 flex flex-col items-center justify-center rounded-2xl border transition-all duration-300 ${
                        selectedDuration === hours 
                        ? 'bg-sky-500/20 border-sky-500/50 shadow-[0_0_20px_rgba(56,189,248,0.2)]' 
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-400'
                     }`}
                   >
                      <span className={`text-2xl font-black ${selectedDuration === hours ? 'text-sky-400' : ''}`}>{hours}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Hour{hours > 1 && 's'}</span>
                   </button>
                ))}
              </div>
           </div>

           {/* Metrics Display */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
              
              {/* Inhaled Toxins */}
              <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 relative overflow-hidden group flex flex-col justify-center">
                 <div className="absolute -bottom-10 -right-10 opacity-10 blur-xl group-hover:opacity-20 transition-all duration-500">
                    <Droplets size={200} className="text-cyan-500" />
                 </div>
                 <div className="relative z-10">
                    <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-6 flex items-center space-x-2">
                      <Wind size={14} /> <span>Estimated Particulate Intake</span>
                    </h3>
                    <div className="flex items-end space-x-2">
                       <span className="text-6xl font-black text-cyan-400 tracking-tighter" style={{ textShadow: '0 0 30px rgba(6,182,212,0.4)' }}>
                         <CountUp end={inhaledParticles} decimals={1} />
                       </span>
                       <span className="text-sm font-bold uppercase text-slate-500 mb-2">µg</span>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-white/5 flex items-start space-x-3">
                       <Activity size={18} className="text-cyan-500 shrink-0 mt-0.5" />
                       <p className="text-xs font-medium text-slate-400 leading-relaxed">
                         Calculated utilizing a standard resting respiratory rate of 8L/min. Does not account for cardiovascular exertion.
                       </p>
                    </div>
                 </div>
              </div>

              {/* Health Impact Assessment */}
              <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 relative overflow-hidden group flex flex-col justify-center">
                 <div className="absolute -bottom-10 -right-10 opacity-10 blur-xl group-hover:opacity-20 transition-all duration-500">
                    <Shield size={200} className="text-pink-500" />
                 </div>
                 <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-6 flex items-center space-x-2">
                        <HeartPulse size={14} className="text-pink-500" /> <span>Clinical Advisory</span>
                      </h3>
                      
                      <div className="px-4 py-3 rounded-xl border border-white/5 bg-black/40 mb-6">
                         <p className="text-sm font-medium text-slate-200 leading-relaxed">
                           {impactText}
                         </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                       <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cumulative Stress Load</span>
                         <span className="text-[10px] font-mono text-pink-400 font-bold">{healthImpactSeverity.toFixed(0)} units</span>
                       </div>
                       <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-linear-to-r from-sky-400 via-amber-400 to-red-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((healthImpactSeverity / 1000) * 100, 100)}%` }}
                            transition={{ duration: 1 }}
                          />
                       </div>
                    </div>
                 </div>
              </div>

           </div>
        </div>

      </div>
    </div>
  );
};

export default Exposure;
