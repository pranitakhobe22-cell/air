import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Shield, Clock, HeartPulse, Wind,
  Users, AlertTriangle, Droplets
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';
import useActiveNode from '@/hooks/useActiveNode';

const rriColor = (rri) => {
  if (rri >= 75) return '#ef4444';
  if (rri >= 55) return '#f97316';
  if (rri >= 35) return '#f59e0b';
  return '#22c55e';
};

const demographics = [
  { id: 'adult', label: 'Healthy Adult', multiplier: 1.0, icon: Users },
  { id: 'child', label: 'Children (<12)', multiplier: 1.3, icon: Users },
  { id: 'elderly', label: 'Elderly (65+)', multiplier: 1.4, icon: Users },
  { id: 'asthma', label: 'Asthmatics', multiplier: 1.8, icon: HeartPulse },
  { id: 'smoker', label: 'Smokers', multiplier: 1.5, icon: Wind },
];

const Exposure = () => {
  const active = useActiveNode();
  const [duration, setDuration] = useState(1);
  const [activeDemo, setActiveDemo] = useState(demographics[0]);

  if (!active.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const baseRri = active.derived.rri || 50;
  const pm25 = active.sensors?.pm25 || 35;
  const personalRri = Math.min(Math.floor(baseRri * activeDemo.multiplier), 100);
  const color = rriColor(personalRri);
  const inhaledParticles = duration * 0.48 * pm25;
  const stressLoad = personalRri * duration;

  let advisory = 'Minimal physiological impact expected.';
  if (stressLoad > 500) advisory = 'Critical exposure. Immediate health effects likely (wheezing, cardiovascular stress).';
  else if (stressLoad > 250) advisory = 'Significant exposure. Respiratory irritation probable for sensitive groups.';
  else if (stressLoad > 100) advisory = 'Moderate exposure. Prolonged outdoor activity not recommended.';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Exposure Calculator</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {active.isNodeView ? `${active.nodeName} — ` : ''}Personalized exposure risk based on demographics and duration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left: RRI gauge + demographics */}
        <div className="lg:col-span-4 space-y-5">

          {/* RRI Gauge */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6 flex flex-col items-center">
            <p className="text-xs text-slate-500 mb-4">Personal RRI</p>
            <div className="relative w-40 h-40 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="85" fill="none" stroke="#1e293b" strokeWidth="6" />
                <motion.circle
                  cx="100" cy="100" r="85" fill="none"
                  stroke={color} strokeWidth="6" strokeLinecap="round"
                  initial={{ strokeDasharray: '0 1000' }}
                  animate={{ strokeDasharray: `${(personalRri / 100) * 534} 1000` }}
                  transition={{ duration: 1 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white tabular-nums">{personalRri}</span>
                <span className="text-xs text-slate-500">/100</span>
              </div>
            </div>
            <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: `${color}15`, color }}>
              {activeDemo.multiplier > 1 ? 'Sensitive Group' : 'Standard Baseline'}
            </span>
          </div>

          {/* Demographics */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 px-1 mb-2">Select profile</p>
            {demographics.map((d) => {
              const isActive = activeDemo.id === d.id;
              const dColor = rriColor(Math.min(baseRri * d.multiplier, 100));
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveDemo(d)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isActive ? 'bg-slate-800/60 border-slate-600' : 'bg-slate-800/30 border-slate-700/40 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <d.icon size={16} style={{ color: isActive ? dColor : '#64748b' }} />
                    <span className={`text-sm ${isActive ? 'text-white font-medium' : 'text-slate-400'}`}>{d.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ backgroundColor: dColor, width: `${Math.min(baseRri * d.multiplier, 100)}%` }} />
                    </div>
                    <span className="text-xs font-mono tabular-nums" style={{ color: dColor }}>x{d.multiplier.toFixed(1)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Duration + Results */}
        <div className="lg:col-span-8 space-y-5">

          {/* Duration */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Clock size={16} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-300">Exposure Duration</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 4, 8, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setDuration(h)}
                  className={`py-4 rounded-lg text-center border transition-colors ${
                    duration === h
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                      : 'bg-slate-900/50 border-slate-700/40 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-xl font-bold block">{h}</span>
                  <span className="text-[11px]">hour{h > 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Particulate Intake */}
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Droplets size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-300">Particulate Intake</h3>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold text-cyan-400 tabular-nums">{inhaledParticles.toFixed(1)}</span>
                <span className="text-sm text-slate-500">ug</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Based on a resting respiratory rate of 8L/min over {duration} hour{duration > 1 ? 's' : ''}.
              </p>
            </div>

            {/* Health Advisory */}
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <HeartPulse size={16} className="text-rose-400" />
                <h3 className="text-sm font-semibold text-slate-300">Advisory</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">{advisory}</p>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-slate-500">Cumulative Stress</span>
                  <span className="text-xs font-medium text-slate-400">{stressLoad} units</span>
                </div>
                <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-red-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((stressLoad / 1000) * 100, 100)}%` }}
                    transition={{ duration: 0.8 }}
                  />
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
