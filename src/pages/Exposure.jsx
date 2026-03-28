import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Shield, Clock, HeartPulse, Wind,
  Users, AlertTriangle, Droplets, Cpu, CheckCircle2
} from 'lucide-react';
import useActiveNode from '@/hooks/useActiveNode';
import { doseResponse, generateAdvisory } from '@/utils/aqiEngine';

const sensitiveTabs = [
  { id: 'asthma', label: 'Asthma/COPD', icon: Activity, threshold: 40 },
  { id: 'children', label: 'Children', icon: Users, threshold: 50 },
  { id: 'elderly', label: 'Elderly', icon: Users, threshold: 45 },
  { id: 'heart', label: 'Heart Patients', icon: HeartPulse, threshold: 45 },
  { id: 'smokers', label: 'Smokers', icon: Wind, threshold: 60 },
];

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
  const [sensitiveTab, setSensitiveTab] = useState(sensitiveTabs[0]);

  const sensitiveAdvisory = useMemo(() => {
    if (!active.ready) return null;
    return generateAdvisory(active.sensors, active.environment, active.derived, sensitiveTab.id);
  }, [active.ready, active.sensors, active.environment, active.derived, sensitiveTab.id]);

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
          <h1 className="text-2xl lg:text-xl font-bold text-(--color-text-primary) tracking-tight">Exposure Calculator</h1>
          <p className="text-sm text-(--color-text-secondary) mt-0.5">
            {active.isNodeView ? `${active.nodeName} — ` : ''}Personalized exposure risk based on demographics and duration.
          </p>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 rounded-lg text-xs font-semibold text-purple-400 self-start sm:self-auto">
          <Cpu size={10} /> Sigmoid Dose-Response Model
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left: RRI gauge + demographics */}
        <div className="lg:col-span-4 space-y-5">

          {/* RRI Gauge */}
          <div className="glass-card rounded-2xl p-6 flex flex-col items-center">
            <p className="text-xs text-(--color-text-secondary) mb-4">Exposure Risk Score</p>
            <div className="relative w-40 h-40 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(128,128,128,0.1)" strokeWidth="6" />
                <motion.circle
                  cx="100" cy="100" r="85" fill="none"
                  stroke={color} strokeWidth="6" strokeLinecap="round"
                  initial={{ strokeDasharray: '0 1000' }}
                  animate={{ strokeDasharray: `${(personalRri / 100) * 534} 1000` }}
                  transition={{ duration: 1 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl lg:text-3xl font-bold text-(--color-text-primary) tabular-nums">{personalRri}</span>
                <span className="text-xs text-(--color-text-secondary)">/100</span>
              </div>
            </div>
            <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: `${color}15`, color }}>
              {activeDemo.multiplier > 1 ? 'Sensitive Group' : 'Standard Baseline'}
            </span>
          </div>

          {/* Demographics */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-(--color-text-secondary) uppercase tracking-wider px-1 mb-2">Select profile</p>
            {demographics.map((d) => {
              const isActive = activeDemo.id === d.id;
              const dDose = doseResponse(pm25, duration, d.multiplier);
              const dColor = rriColor(dDose.risk);
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveDemo(d)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                    isActive ? 'bg-white/[0.05]' : 'subtle-surface hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <d.icon size={16} style={{ color: isActive ? dColor : '#64748b' }} />
                    <span className={`text-sm ${isActive ? 'text-(--color-text-primary) font-medium' : 'text-(--color-text-secondary)'}`}>{d.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1 subtle-surface rounded-full overflow-hidden">
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
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Clock size={16} className="text-(--color-text-secondary)" />
              <h3 className="text-base font-semibold text-(--color-text-primary)">Exposure Duration</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 4, 8, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setDuration(h)}
                  className={`py-4 rounded-xl text-center transition-colors ${
                    duration === h
                      ? 'bg-sky-500/10 text-sky-400'
                      : 'subtle-surface text-(--color-text-secondary) hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="text-xl lg:text-lg font-bold block">{h}</span>
                  <span className="text-[11px]">hour{h > 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Particulate Intake */}
            <div className="glass-card rounded-2xl p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Droplets size={16} className="text-cyan-400" />
                <h3 className="text-base font-semibold text-(--color-text-primary)">Particulate Intake</h3>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl lg:text-3xl font-bold text-cyan-400 tabular-nums">{dose.inhaledMass.toFixed(1)}</span>
                <span className="text-sm text-(--color-text-secondary)">µg</span>
              </div>
              <p className="text-xs text-(--color-text-secondary) leading-relaxed mb-4">
                Based on respiratory rate of {dose.breathingRate} m³/hr over {duration} hour{duration > 1 ? 's' : ''}.
                Total volume: {(dose.breathingRate * duration).toFixed(1)} m³ inhaled.
              </p>
              <div className="mt-auto pt-4 border-t border-(--color-card-border) space-y-2.5">
                {[
                  { label: 'Breathing Rate', value: `${dose.breathingRate} m³/hr` },
                  { label: 'Air Volume Inhaled', value: `${(dose.breathingRate * duration).toFixed(1)} m³` },
                  { label: 'PM2.5 Concentration', value: `${pm25.toFixed(1)} µg/m³` },
                  { label: 'Vulnerability Factor', value: `×${activeDemo.multiplier.toFixed(1)}` },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-(--color-text-secondary)">{r.label}</span>
                    <span className="text-xs font-semibold text-(--color-text-primary)">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Health Advisory */}
            <div className="glass-card rounded-2xl p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <HeartPulse size={16} className="text-rose-400" />
                <h3 className="text-base font-semibold text-(--color-text-primary)">Advisory</h3>
              </div>
              <p className="text-sm text-(--color-text-primary) leading-relaxed mb-4">{dose.advisory}</p>
              <div className="mb-5">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-(--color-text-secondary)">Cumulative Stress</span>
                  <span className="text-xs font-medium text-(--color-text-secondary)">{dose.stressScore} units</span>
                </div>
                <div className="h-1.5 subtle-surface rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-red-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((dose.stressScore / 1000) * 100, 100)}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-(--color-card-border) space-y-2.5">
                {[
                  { label: 'Risk Level', value: personalRri >= 75 ? 'High' : personalRri >= 55 ? 'Moderate-High' : personalRri >= 35 ? 'Moderate' : 'Low', color: color },
                  { label: 'Mask Recommendation', value: pm25 > 55 ? 'N95 Required' : pm25 > 35 ? 'Surgical Mask' : 'Not Required' },
                  { label: 'Outdoor Activity', value: personalRri >= 60 ? 'Avoid' : personalRri >= 40 ? 'Limit' : 'Safe' },
                  { label: 'Profile', value: activeDemo.label },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-(--color-text-secondary)">{r.label}</span>
                    <span className="text-xs font-semibold" style={{ color: r.color || 'var(--color-text-primary)' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Sensitive Groups (full width) ──────────────────── */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
          <h3 className="text-base font-semibold text-(--color-text-primary)">Sensitive Groups</h3>
          <div className="flex flex-wrap gap-1.5">
            {sensitiveTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSensitiveTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  sensitiveTab.id === tab.id
                    ? 'bg-sky-500/[0.12] text-sky-400'
                    : 'text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={sensitiveTab.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className={`p-5 rounded-xl ${sensitiveAdvisory?.isDanger ? 'bg-red-500/[0.04]' : 'bg-white/10'}`}>
              <div className="flex items-center gap-2 mb-3">
                {sensitiveAdvisory?.isDanger ? <AlertTriangle size={16} className="text-red-400" /> : <CheckCircle2 size={16} className="text-emerald-400" />}
                <span className={`text-sm font-semibold ${sensitiveAdvisory?.isDanger ? 'text-red-400' : 'text-emerald-400'}`}>
                  {sensitiveAdvisory?.isDanger ? 'Caution Required' : 'Normal Activity OK'}
                </span>
              </div>
              <p className="text-sm text-(--color-text-secondary) leading-relaxed">
                Current RRI is {active.derived?.rri || 0}. The {sensitiveTab.label} threshold is {sensitiveAdvisory?.groupThreshold || sensitiveTab.threshold}.
                {sensitiveAdvisory?.isDanger
                  ? ' Conditions exceed safe levels for this group. Limit outdoor exposure.'
                  : ' Present conditions are within safe parameters.'}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white/10">
              <p className="text-xs text-(--color-text-secondary) mb-3">Recommendations</p>
              <ul className="space-y-2.5">
                {(sensitiveAdvisory?.recommendations || []).slice(0, 4).map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-sky-400 rounded-full mt-1.5 shrink-0" />
                    <span className="text-sm text-(--color-text-primary)">{rec}</span>
                  </li>
                ))}
                {(!sensitiveAdvisory?.recommendations || sensitiveAdvisory.recommendations.length === 0) && (
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-sky-400 rounded-full mt-1.5 shrink-0" />
                    <span className="text-sm text-(--color-text-primary)">No specific concerns for current conditions.</span>
                  </li>
                )}
              </ul>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── WHO & NAAQS Guidelines (full width, 3-col) ─────── */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-emerald-400" />
          <h3 className="text-base font-semibold text-(--color-text-primary)">WHO & NAAQS Guidelines</h3>
        </div>
        <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-5">
          WHO recommends annual PM2.5 averages below 5 µg/m³ and 24-hour exposures below 15 µg/m³.
          India's NAAQS sets the 24-hour PM2.5 limit at 60 µg/m³.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* WHO 24hr */}
          <div className="p-4 subtle-surface rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider">WHO 24-Hour Limit</span>
              <span className="text-xs font-bold text-emerald-400">15 µg/m³</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-(--color-text-secondary)">Current PM2.5</span>
              <span className={`text-sm font-bold tabular-nums ${pm25 > 15 ? 'text-rose-400' : 'text-emerald-400'}`}>{pm25.toFixed(1)} µg/m³</span>
            </div>
            <div className="h-2 subtle-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min((pm25 / 15) * 100, 100)}%`, background: pm25 > 15 ? 'linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)' : '#22c55e' }} />
            </div>
            <p className={`text-xs font-medium ${pm25 > 15 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {pm25 > 15 ? `${(pm25 / 15).toFixed(1)}× above WHO limit` : 'Within WHO safe limits'}
            </p>
          </div>

          {/* NAAQS */}
          <div className="p-4 subtle-surface rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider">India NAAQS 24-Hour</span>
              <span className="text-xs font-bold text-sky-400">60 µg/m³</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-(--color-text-secondary)">Current PM2.5</span>
              <span className={`text-sm font-bold tabular-nums ${pm25 > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>{pm25.toFixed(1)} µg/m³</span>
            </div>
            <div className="h-2 subtle-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min((pm25 / 60) * 100, 100)}%`, background: pm25 > 60 ? 'linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)' : '#06b6d4' }} />
            </div>
            <p className={`text-xs font-medium ${pm25 > 60 ? 'text-rose-400' : 'text-sky-400'}`}>
              {pm25 > 60 ? `${(pm25 / 60).toFixed(1)}× above NAAQS limit` : 'Within NAAQS safe limits'}
            </p>
          </div>

          {/* WHO Annual */}
          <div className="p-4 subtle-surface rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider">WHO Annual Average</span>
              <span className="text-xs font-bold text-emerald-400">5 µg/m³</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-(--color-text-secondary)">Current PM2.5</span>
              <span className={`text-sm font-bold tabular-nums ${pm25 > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>{pm25.toFixed(1)} µg/m³</span>
            </div>
            <div className="h-2 subtle-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min((pm25 / 5) * 100, 100)}%`, background: 'linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)' }} />
            </div>
            <p className={`text-xs font-medium ${pm25 > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {(pm25 / 5).toFixed(1)}× the WHO annual guideline
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Exposure;

