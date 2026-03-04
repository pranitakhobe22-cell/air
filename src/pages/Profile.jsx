import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Shield, Save, Edit3, Activity, Heart, Clock, 
  Wind, Lock, AlertTriangle, Calculator, FileText 
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';

// Helper to simulate the exact math the engine runs
const calculateLiveModifier = (form, baseAqi) => {
  let modifier = 1.0;
  
  // Age impact
  if (form.age < 12) modifier += 0.25;
  else if (form.age > 65) modifier += 0.3;
  
  // Conditions
  if (form.conditions?.includes('Asthma')) modifier += 0.4;
  if (form.conditions?.includes('Heart Disease')) modifier += 0.35;
  if (form.conditions?.includes('COPD')) modifier += 0.5;
  
  // Smoking
  if (form.smoking === 'heavy') modifier += 0.3;
  else if (form.smoking === 'light') modifier += 0.15;

  return {
    rawLevel: Number(modifier.toFixed(2)),
    simulatedRri: Math.min(100, Math.round(baseAqi * modifier)),
    color: modifier >= 1.5 ? '#ef4444' : modifier >= 1.2 ? '#f59e0b' : '#10b981'
  };
};

const Profile = () => {
  const { data, fetchLatest, updateProfile } = useAerisStore();

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: 'User',
    age: 32,
    gender: 'prefer_not_to_say',
    smoking: 'none',
    conditions: [],
  });

  useEffect(() => {
    if (data?.userProfile) {
      setForm(prev => ({ ...prev, ...data.userProfile }));
    }
  }, [data?.userProfile]);

  const handleSave = async () => {
    try {
      await updateProfile(form);
      setEditing(false);
    } catch (e) {
      console.error('Profile save failed:', e);
    }
  };

  if (!data?.derived) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { derived } = data;
  const baseAqi = derived.aqi || 50;
  const liveMath = calculateLiveModifier(form, baseAqi);
  
  const conditionOptions = ['Asthma', 'COPD', 'Heart Disease', 'Diabetes', 'Allergies', 'Immunocompromised'];

  return (
    <div className="p-8 pb-32 max-w-[1600px] mx-auto space-y-8 text-slate-100 selection:bg-purple-500/30">
      
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <User size={24} className="text-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.5)]" />
            <h1 className="text-3xl font-black tracking-tight">Physiological Profile</h1>
          </div>
          <p className="text-slate-400 font-medium">Configure medical baselines to calculate your precise RRI multiplier.</p>
        </div>
        
        <div className="flex items-center space-x-4">
           {/* Secure Data Notice */}
           <div className="hidden md:flex items-center space-x-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
             <Lock size={12} className="text-emerald-500" />
             <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">HIPAA Compliant Local Storage</span>
           </div>

           <button
             onClick={() => editing ? handleSave() : setEditing(true)}
             className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg ${
               editing 
                 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                 : 'bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20'
             }`}
           >
             {editing ? <><Save size={16} /> <span>Save Parameters</span></> : <><Edit3 size={16} /> <span>Edit Profile</span></>}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* ── Left Column: Configuration Form ─────────────── */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative">
            
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-8 flex items-center space-x-2">
               <FileText size={14} className="text-purple-400" />
               <span>Medical Baseline Intake</span>
            </h3>
            
            <div className="space-y-8">
               {/* Basic Demo Row */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Biological Age</label>
                   {editing ? (
                     <div className="relative">
                       <input 
                         type="number" 
                         value={form.age} 
                         onChange={(e) => setForm({...form, age: Number(e.target.value)})}
                         className="w-full bg-[#0B0F1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                       />
                       <Clock size={16} className="absolute right-4 top-3.5 text-slate-600" />
                     </div>
                   ) : (
                     <div className="text-lg font-bold text-white p-3 border border-white/5 rounded-xl bg-white/5">{form.age} Years</div>
                   )}
                 </div>

                 <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Gender</label>
                   {editing ? (
                     <select 
                       value={form.gender} 
                       onChange={(e) => setForm({...form, gender: e.target.value})}
                       className="w-full bg-[#0B0F1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors appearance-none"
                     >
                       <option value="male">Male</option>
                       <option value="female">Female</option>
                       <option value="prefer_not_to_say">Prefer Not To Say</option>
                     </select>
                   ) : (
                     <div className="text-lg font-bold text-white p-3 border border-white/5 rounded-xl bg-white/5 capitalize">{form.gender.replace(/_/g, ' ')}</div>
                   )}
                 </div>
               </div>

               {/* Smoking / Vaping */}
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Smoking / Vaping Frequency</label>
                  {editing ? (
                    <div className="grid grid-cols-3 gap-3">
                       {['none', 'light', 'heavy'].map(lvl => (
                         <button
                           key={lvl}
                           onClick={() => setForm({...form, smoking: lvl})}
                           className={`py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${
                             form.smoking === lvl 
                               ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                               : 'bg-[#0B0F1A] border-white/5 text-slate-500 hover:text-slate-300'
                           }`}
                         >
                           {lvl}
                         </button>
                       ))}
                    </div>
                  ) : (
                    <div className="text-lg font-bold text-slate-300 p-3 border border-white/5 rounded-xl bg-white/5 capitalize">
                      {form.smoking === 'none' ? 'Non-Smoker' : `${form.smoking} Frequency`}
                    </div>
                  )}
               </div>

               {/* Pre-existing Conditions */}
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center space-x-2 block">
                     <span>Pre-Existing Conditions</span>
                     <AlertTriangle size={12} className="text-amber-500" />
                  </label>
                  
                  {editing ? (
                    <div className="flex flex-wrap gap-3">
                       {conditionOptions.map(cond => {
                         const isSelected = form.conditions?.includes(cond);
                         return (
                           <button
                             key={cond}
                             onClick={() => {
                               const arr = form.conditions || [];
                               setForm({...form, conditions: isSelected ? arr.filter(c => c !== cond) : [...arr, cond]});
                             }}
                             className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                               isSelected 
                                 ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' 
                                 : 'bg-[#0B0F1A] border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5'
                             }`}
                           >
                             {cond}
                           </button>
                         )
                       })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                       {form.conditions?.length > 0 ? (
                         form.conditions.map(c => (
                           <span key={c} className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-bold">
                             {c}
                           </span>
                         ))
                       ) : (
                         <span className="text-sm font-medium text-slate-500 italic p-3 border border-white/5 rounded-xl bg-[#0B0F1A] w-full block">No conditions reported.</span>
                       )}
                    </div>
                  )}
               </div>

            </div>
          </div>
        </div>

        {/* ── Right Column: Risk Math Breakdown ───────────── */}
        <div className="xl:col-span-5 space-y-6">
          
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
             
             {/* Glow matched to the multiplier danger */}
             <div className="absolute top-0 right-0 w-64 h-64 blur-[80px] opacity-20 transition-all duration-1000 pointer-events-none" style={{ backgroundColor: liveMath.color }} />
             
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-8 flex items-center space-x-2 relative z-10">
               <Calculator size={14} className="text-white" />
               <span>Live Engine Calculation</span>
             </h3>
             
             <div className="space-y-6 relative z-10">
                {/* 1. Base AQI */}
                <div className="flex items-center justify-between p-4 bg-[#0B0F1A] border border-white/5 rounded-xl">
                   <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 bg-slate-800/50 px-2 py-1 rounded w-max mb-1">Step 1</span>
                      <span className="text-xs font-bold text-slate-300">Global AQI Metric</span>
                   </div>
                   <span className="text-2xl font-black text-white">{baseAqi}</span>
                </div>

                {/* Mathematical Operator */}
                <div className="flex justify-center -my-3 relative z-20">
                   <div className="w-8 h-8 rounded-full bg-slate-800 border-4 border-[#111827] flex items-center justify-center text-slate-400">
                     <span className="font-mono font-bold">✕</span>
                   </div>
                </div>

                {/* 2. Demographic Multiplier */}
                <div className="flex items-center justify-between p-4 bg-[#0B0F1A] border border-white/5 rounded-xl" style={{ borderColor: `${liveMath.color}40` }}>
                   <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 bg-slate-800/50 px-2 py-1 rounded w-max mb-1" style={{ color: liveMath.color }}>Step 2</span>
                      <span className="text-xs font-bold text-slate-300">Vulnerability Modifier</span>
                   </div>
                   <div className="flex items-baseline space-x-1">
                      <span className="text-2xl font-black" style={{ color: liveMath.color }}>{liveMath.rawLevel}</span>
                      <span className="text-xs font-bold text-slate-500">x</span>
                   </div>
                </div>

                {/* Math Breakdown List */}
                <div className="pl-6 border-l-2 border-slate-800 space-y-2 py-2">
                   <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-slate-500">
                     <span>Base Healthy Adult</span>
                     <span>1.00x</span>
                   </div>
                   {(form.age < 12 || form.age > 65) && (
                     <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-amber-500">
                       <span>Age Factor ({form.age})</span>
                       <span>+{form.age < 12 ? '0.25' : '0.30'}x</span>
                     </div>
                   )}
                   {form.smoking !== 'none' && (
                     <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-orange-500">
                       <span>Smoking ({form.smoking})</span>
                       <span>+{form.smoking === 'heavy' ? '0.30' : '0.15'}x</span>
                     </div>
                   )}
                   {form.conditions?.length > 0 && (
                     <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-rose-500">
                       <span>Clinical Conditions</span>
                       <span>+{(liveMath.rawLevel - 1.0 - (form.age < 12 ? 0.25 : form.age > 65 ? 0.3 : 0) - (form.smoking === 'heavy' ? 0.3 : form.smoking === 'light' ? 0.15 : 0)).toFixed(2)}x</span>
                     </div>
                   )}
                </div>

                {/* Equals */}
                <div className="w-full h-px bg-white/10 my-4" />

                {/* 3. Final Personalized RRI */}
                <div className="text-center py-6 bg-linear-to-b from-white/5 to-transparent rounded-2xl border border-white/10" style={{ borderColor: `${liveMath.color}50` }}>
                   <span className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-400 mb-2 block">Your Simulated RRI</span>
                   <div className="text-7xl font-black tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" style={{ color: liveMath.color }}>
                     {liveMath.simulatedRri}
                   </div>
                   {(editing && liveMath.simulatedRri !== derived.rri) && (
                     <p className="text-xs font-bold text-sky-400 mt-4 animate-pulse uppercase tracking-widest">
                        Unsaved Changes Preview
                     </p>
                   )}
                </div>

             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
