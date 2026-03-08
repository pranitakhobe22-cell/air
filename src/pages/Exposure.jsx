import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Shield, Clock, HeartPulse, Wind,
  Users, AlertTriangle, Droplets, Cpu
} from 'lucide-react';
import useActiveNode from '@/hooks/useActiveNode';
import { doseResponse } from '@/utils/aqiEngine';

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

  const baseRri = active.derived.rri || 0;
  const pm25 = active.sensors?.pm25 || 0;

  // Non-linear sigmoid dose-response model (Hill equation)
  const dose = doseResponse(pm25, duration, activeDemo.multiplier);
  const personalRri = dose.risk;
  const color = rriColor(personalRri);

  return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Exposure Calculator</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {active.isNodeView ? `${active.nodeName} — ` : ''}Personalized exposure risk based on demographics and duration.
          </p>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 rounded-lg text-[10px] font-semibold text-purple-400 self-start sm:self-auto">
          <Cpu size={10} /> Sigmoid Dose-Response Model
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left: RRI gauge + demographics */}
        <div className="lg:col-span-4 space-y-5">

          {/* RRI Gauge */}
          <div className="bg-white/[0.03] rounded-2xl p-6 flex flex-col items-center">
            <p className="text-xs text-slate-500 mb-4">Exposure Risk Score</p>
            <div className="relative w-40 h-40 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
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
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider px-1 mb-2">Select profile</p>
            {demographics.map((d) => {
              const isActive = activeDemo.id === d.id;
              const dDose = doseResponse(pm25, duration, d.multiplier);
              const dColor = rriColor(dDose.risk);
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveDemo(d)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                    isActive ? 'bg-white/[0.05]' : 'bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <d.icon size={16} style={{ color: isActive ? dColor : '#64748b' }} />
                    <span className={`text-sm ${isActive ? 'text-white font-medium' : 'text-slate-400'}`}>{d.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ backgroundColor: dColor, width: `${dDose.risk}%` }} />
                    </div>
                    <span className="text-xs font-mono tabular-nums" style={{ color: dColor }}>{dDose.risk}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Duration + Results */}
        <div className="lg:col-span-8 space-y-5">

          {/* Duration */}
          <div className="bg-white/[0.03] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Clock size={16} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-white">Exposure Duration</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 4, 8, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setDuration(h)}
                  className={`py-4 rounded-xl text-center transition-colors ${
                    duration === h
                      ? 'bg-sky-500/10 text-sky-400'
                      : 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'
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
            <div className="bg-white/[0.03] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Droplets size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Particulate Intake</h3>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold text-cyan-400 tabular-nums">{dose.inhaledMass.toFixed(1)}</span>
                <span className="text-sm text-slate-500">µg</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Based on respiratory rate of {dose.breathingRate} m³/hr over {duration} hour{duration > 1 ? 's' : ''}.
                Total volume: {(dose.breathingRate * duration).toFixed(1)} m³ inhaled.
              </p>
            </div>

            {/* Health Advisory */}
            <div className="bg-white/[0.03] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <HeartPulse size={16} className="text-rose-400" />
                <h3 className="text-sm font-semibold text-white">Advisory</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">{dose.advisory}</p>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-slate-500">Cumulative Stress</span>
                  <span className="text-xs font-medium text-slate-400">{dose.stressScore} units</span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-red-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((dose.stressScore / 1000) * 100, 100)}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Model Info */}
          <div className="bg-white/[0.03] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Model Parameters</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'PM2.5 Conc.', value: `${pm25.toFixed(1)} µg/m³` },
                { label: 'Hill Coefficient', value: '2.2' },
                { label: 'EC50 Threshold', value: '55 µg/m³' },
                { label: 'Vuln. Modifier', value: `×${activeDemo.multiplier.toFixed(1)}` },
              ].map(p => (
                <div key={p.label} className="p-3 bg-white/[0.02] rounded-xl">
                  <p className="text-[10px] text-slate-500 mb-1">{p.label}</p>
                  <p className="text-sm font-semibold text-white">{p.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Exposure;
