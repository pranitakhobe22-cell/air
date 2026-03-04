import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, Shield, AlertTriangle, Activity, ThermometerSun, 
  Droplets, Wind, User, Baby, ArrowUpRight, CheckCircle2 
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';

// Sensitive Demographics Tabs
const sensitiveTabs = [
  { id: 'asthma', label: 'Asthma / COPD', icon: Activity, thresholdRri: 40 },
  { id: 'children', label: 'Children', icon: Baby, thresholdRri: 50 },
  { id: 'elderly', label: 'Elderly (65+)', icon: User, thresholdRri: 45 },
  { id: 'heart', label: 'Heart Patients', icon: Heart, thresholdRri: 45 },
  { id: 'smokers', label: 'Smokers', icon: Wind, thresholdRri: 60 },
];

const Health = () => {
  const { data, fetchLatest } = useAerisStore();
  const [activeTab, setActiveTab] = useState(sensitiveTabs[0]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  if (!data?.derived) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 text-sky-500 border-t-sky-500 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
      </div>
    );
  }

  const { derived, environment, sensors } = data;
  const rri = derived.rri || 50;
  const pm25 = sensors?.pm25 || 35;
  const temp = environment?.temperature || 25;
  
  // Dynamic Guidance Logic
  const needsMask = rri >= 50;
  const outdoorLimit = rri >= 80 ? '0 hrs (Avoid)' : rri >= 60 ? '1-2 hrs Max' : rri >= 40 ? '4-5 hrs' : 'Unlimited';
  const hydrationMultiplier = temp > 30 ? 1.5 : temp > 25 ? 1.2 : 1.0;
  const hydrationOz = Math.floor(64 * hydrationMultiplier); 
  const breathingLevel = rri < 40 ? 'Deep Box Breathing recommended.' : 'Switch to shallow, indoor respiratory exercises.';

  // Tab Danger Status
  const isDangerForTab = rri >= activeTab.thresholdRri;

  return (
    <div className="p-8 pb-32 max-w-[1600px] mx-auto space-y-8 text-slate-100 selection:bg-emerald-500/30">
      
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Shield size={24} className="text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
            <h1 className="text-3xl font-black tracking-tight">Health Center</h1>
          </div>
          <p className="text-slate-400 font-medium z-10 relative">Clinical guidance and physiological emergency protocols.</p>
        </div>
        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center space-x-2">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#34d399]" />
           <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Medical AI Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* ── Left Column: Core Guidance ──────────────────── */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* Current Guidance Dashboard */}
          <div className="bg-[#111827]/80 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
             <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />
             
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-8 flex items-center space-x-2">
               <Activity size={14} className="text-emerald-500" />
               <span>Current Prescribed Guidance</span>
             </h3>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Mask Recommendation */}
                <div className={`p-6 rounded-2xl border transition-colors ${needsMask ? 'bg-amber-500/10 border-amber-500/20' : 'bg-[#0B0F1A] border-white/10'}`}>
                   <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center mb-4">
                      <Shield size={20} className={needsMask ? 'text-amber-400' : 'text-emerald-400'} />
                   </div>
                   <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Respirator</h4>
                   <div className={`text-lg font-black ${needsMask ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {needsMask ? 'N95 Required' : 'Not Needed'}
                   </div>
                </div>

                {/* 2. Outdoor Duration */}
                <div className="p-6 rounded-2xl border border-white/10 bg-[#0B0F1A]">
                   <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center mb-4 border border-white/5">
                      <ThermometerSun size={20} className="text-sky-400" />
                   </div>
                   <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Outdoor Limit</h4>
                   <div className="text-lg font-black text-sky-400">{outdoorLimit}</div>
                </div>

                {/* 3. Hydration Tips */}
                <div className="p-6 rounded-2xl border border-white/10 bg-[#0B0F1A]">
                   <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center mb-4 border border-white/5">
                      <Droplets size={20} className="text-blue-400" />
                   </div>
                   <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Daily Intake</h4>
                   <div className="text-lg font-black text-blue-400">{hydrationOz} oz (Water)</div>
                </div>

                {/* 4. Breathing Exercise */}
                <div className="p-6 rounded-2xl border border-white/10 bg-[#0B0F1A]">
                   <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center mb-4 border border-white/5">
                      <Wind size={20} className="text-purple-400" />
                   </div>
                   <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Pursed-Lip</h4>
                   <div className="text-lg font-black text-purple-400">4-7-8 Rhythm</div>
                </div>
             </div>
             
             {/* Breathing text */}
             <div className="mt-6 pt-6 border-t border-white/5 flex items-center space-x-3 text-slate-400 text-sm font-medium">
               <CheckCircle2 size={16} className="text-emerald-500" />
               <span>{breathingLevel} Maintains alveolar ventilation while managing particulate deposition.</span>
             </div>
          </div>

          {/* Sensitive Demographic Tabs */}
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl">
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center space-x-2">
                 <User size={14} className="text-indigo-400" />
                 <span>Sensitive Group Specifics</span>
               </h3>
               
               {/* Tab Controls */}
               <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
                 {sensitiveTabs.map(tab => (
                   <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab)}
                     className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center space-x-2 ${
                       activeTab.id === tab.id 
                         ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                         : 'bg-white/5 border border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
                     }`}
                   >
                     <tab.icon size={12} />
                     <span>{tab.label}</span>
                   </button>
                 ))}
               </div>
             </div>

             {/* Tab Content */}
             <AnimatePresence mode="wait">
               <motion.div
                 key={activeTab.id}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 transition={{ duration: 0.3 }}
                 className="grid grid-cols-1 md:grid-cols-2 gap-6"
               >
                 <div className={`p-8 rounded-2xl border relative overflow-hidden ${isDangerForTab ? 'bg-red-500/5 border-red-500/30' : 'bg-[#0B0F1A] border-white/10'}`}>
                    <div className="relative z-10">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className={`p-2 rounded-lg 
                          ${isDangerForTab ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                           {isDangerForTab ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                        </div>
                        <h4 className={`text-lg font-black ${isDangerForTab ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isDangerForTab ? 'Critical Restraint Required' : 'Standard Routine Allowed'}
                        </h4>
                      </div>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        Current Environmental RRI is {rri}. As a member of the {activeTab.label} group, your personalized risk threshold is {activeTab.thresholdRri}. 
                        {isDangerForTab ? ' Conditions exceed safe parameters for your profile. Halt outdoor exertion immediately.' : ' Present conditions do not trigger acute threat assessments for your demographic.'}
                      </p>
                    </div>
                 </div>

                 <div className="p-8 rounded-2xl bg-[#0B0F1A] border border-white/10 flex flex-col justify-center">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Recommended Interventions</h5>
                    <ul className="space-y-3">
                      <li className="flex items-start flex-col gap-1">
                        <div className="flex items-center space-x-2 text-sm font-bold text-slate-300">
                           <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                           <span>Pharmacological Readiness</span>
                        </div>
                        <span className="text-xs text-slate-500 pl-3.5">Keep rescue inhalers, vasodilators, or prescribed emergency meds on person.</span>
                      </li>
                      <li className="flex items-start flex-col gap-1">
                        <div className="flex items-center space-x-2 text-sm font-bold text-slate-300">
                           <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                           <span>HVAC Recirculation</span>
                        </div>
                        <span className="text-xs text-slate-500 pl-3.5">Ensure vehicle and home air conditioning is set to recirculate, utilizing HEPA filtration.</span>
                      </li>
                    </ul>
                 </div>
               </motion.div>
             </AnimatePresence>
          </div>

        </div>

        {/* ── Right Column: Emergency & Official ───────────── */}
        <div className="xl:col-span-4 space-y-8">
          
          {/* Emergency Symptoms Panel */}
          <div className="bg-red-950/20 backdrop-blur-2xl border border-red-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-red-500/20 transition-all duration-500" />
             
             <div className="flex items-center space-x-3 mb-6 relative z-10">
                <Heart size={20} className="text-red-500 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-red-500">Emergency Protocol</h3>
             </div>
             
             <p className="text-xs font-bold text-slate-400 mb-6 relative z-10 uppercase tracking-widest leading-relaxed">
               If experiencing any of the following, seek immediate medical intervention.
             </p>

             <div className="space-y-3 relative z-10">
                {[
                  'Severe shortness of breath',
                  'Chest pain or intense tightness',
                  'Prolonged dizziness or vertigo',
                  'Cyanosis (blue lips or fingertips)',
                  'Uncontrollable coughing fits'
                ].map((symptom, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">
                     <AlertTriangle size={14} className="text-red-400" />
                     <span className="text-sm font-bold text-slate-200">{symptom}</span>
                  </div>
                ))}
             </div>
             
             <button className="w-full mt-8 py-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-red-400 font-black uppercase tracking-widest text-xs transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)]">
               Call Local Emergency Services
             </button>
          </div>

          {/* Official WHO Advisory Section */}
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl flex flex-col h-[calc(100%-24rem)] min-h-[300px]">
             <div className="flex items-center space-x-3 mb-6">
                <ArrowUpRight size={18} className="text-sky-400" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Global Standards</h3>
             </div>
             
             <h4 className="text-2xl font-black text-white mb-2 tracking-tight">WHO Air Quality Guidelines 2021</h4>
             <p className="text-sm text-slate-400 leading-relaxed mb-6 flex-1">
               The World Health Organization explicitly states that annual average concentrations of PM2.5 should not exceed 5 µg/m³, while 24-hour average exposures should not exceed 15 µg/m³ more than 3-4 days per year.
             </p>

             <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/5">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current PM2.5 Load</span>
                   <span className="text-xs font-black text-rose-400">{pm25} µg/m³</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">WHO 24hr Standard</span>
                   <span className="text-xs font-black text-emerald-400">15 µg/m³</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                   <div 
                     className="h-full bg-linear-to-r from-emerald-400 to-rose-500"
                     style={{ width: `${Math.min((pm25 / 15) * 100, 100)}%` }}
                   />
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Health;
