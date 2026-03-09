import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Shield, AlertTriangle, Activity, Thermometer,
  Droplets, Wind, User, CheckCircle2, Cpu, Fan, Home, Info
} from 'lucide-react';
import useActiveNode from '@/hooks/useActiveNode';
import { generateAdvisory } from '@/utils/aqiEngine';

// Wispy smoke clouds — large, billowing, overlapping for realism
const smokeClouds = [
  // Big slow wisps that billow upward
  { w: 40, h: 28, x0: 0, xEnd: -22, rise: -110, dur: 4.0, delay: 0, originX: 8, blur: 12, peakOp: 0.22 },
  { w: 50, h: 32, x0: 4, xEnd: 18, rise: -130, dur: 4.5, delay: 0.8, originX: 4, blur: 14, peakOp: 0.18 },
  { w: 35, h: 24, x0: -2, xEnd: -30, rise: -95, dur: 3.6, delay: 1.6, originX: 10, blur: 10, peakOp: 0.25 },
  // Medium drifters
  { w: 28, h: 20, x0: 6, xEnd: 25, rise: -85, dur: 3.2, delay: 0.4, originX: 2, blur: 8, peakOp: 0.28 },
  { w: 32, h: 22, x0: -4, xEnd: -15, rise: -100, dur: 3.8, delay: 2.0, originX: 12, blur: 11, peakOp: 0.2 },
  { w: 45, h: 30, x0: 2, xEnd: 12, rise: -120, dur: 4.2, delay: 1.2, originX: 6, blur: 13, peakOp: 0.16 },
  // Small fast tendrils near tip
  { w: 16, h: 14, x0: 0, xEnd: -8, rise: -55, dur: 2.2, delay: 0.2, originX: 8, blur: 5, peakOp: 0.35 },
  { w: 14, h: 12, x0: 4, xEnd: 10, rise: -50, dur: 2.0, delay: 1.0, originX: 4, blur: 4, peakOp: 0.3 },
  { w: 18, h: 16, x0: -2, xEnd: -12, rise: -60, dur: 2.5, delay: 1.8, originX: 10, blur: 6, peakOp: 0.32 },
  // Lingering haze
  { w: 60, h: 35, x0: 0, xEnd: -10, rise: -140, dur: 5.5, delay: 0.6, originX: 6, blur: 18, peakOp: 0.1 },
  { w: 55, h: 30, x0: 2, xEnd: 15, rise: -150, dur: 5.0, delay: 2.4, originX: 8, blur: 16, peakOp: 0.08 },
];

const SmokingCigarette = () => (
  <div className="relative flex flex-col items-center shrink-0" style={{ width: 140, height: 180 }}>
    {/* Smoke wisps — positioned above the burning tip */}
    {smokeClouds.map((s, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          width: s.w,
          height: s.h,
          bottom: 100,
          left: 70 + s.originX,
          filter: `blur(${s.blur}px)`,
          background: `radial-gradient(ellipse, rgba(180,190,205,${s.peakOp}) 0%, rgba(140,150,170,${s.peakOp * 0.4}) 40%, transparent 70%)`,
        }}
        animate={{
          y: [0, s.rise * 0.3, s.rise * 0.65, s.rise],
          x: [s.x0, s.x0 + s.xEnd * 0.3, s.xEnd * 0.7, s.xEnd],
          opacity: [0, s.peakOp, s.peakOp * 0.6, 0],
          scale: [0.3, 0.8, 1.4, 2.2],
        }}
        transition={{
          duration: s.dur,
          repeat: Infinity,
          delay: s.delay,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      />
    ))}

    {/* Heat shimmer near tip */}
    <motion.div
      className="absolute rounded-full"
      style={{
        width: 20, height: 30, bottom: 88, left: 78,
        background: 'radial-gradient(ellipse, rgba(251,191,36,0.08) 0%, transparent 70%)',
        filter: 'blur(6px)',
      }}
      animate={{ opacity: [0.3, 0.6, 0.3], scaleY: [1, 1.3, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />

    {/* Cigarette body — tilted slightly for natural look */}
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2" style={{ transform: 'translateX(-50%) rotate(-5deg)' }}>
      <div className="relative flex items-center">
        {/* Filter section */}
        <div className="relative overflow-hidden rounded-l-sm" style={{ width: 36, height: 14 }}>
          <div className="absolute inset-0 bg-gradient-to-b from-amber-600 via-amber-700 to-amber-800" />
          {/* Filter texture lines */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 3px)',
          }} />
          {/* Cork ring */}
          <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-amber-900/30" />
        </div>

        {/* Paper section */}
        <div className="relative overflow-hidden" style={{ width: 60, height: 14 }}>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-100 via-white to-slate-200" />
          {/* Paper grain */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)',
          }} />
          {/* Brand ring */}
          <div className="absolute left-4 top-0 bottom-0 w-[2px] bg-sky-200/20" />
          <div className="absolute left-5 top-0 bottom-0 w-[1px] bg-sky-200/10" />
        </div>

        {/* Ash section — crumbly gray */}
        <div className="relative" style={{ width: 8, height: 14 }}>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-300 to-slate-400 rounded-r-[1px]" />
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(80,80,80,0.4) 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(60,60,60,0.3) 1px, transparent 1px)',
          }} />
        </div>

        {/* Burning ember tip */}
        <div className="relative" style={{ width: 6, height: 14 }}>
          <div className="absolute inset-0 rounded-r-sm bg-gradient-to-r from-orange-600 via-red-500 to-red-700" />
          {/* Ember glow — warm pulsing light */}
          <motion.div
            className="absolute -inset-2 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.5) 0%, rgba(239,68,68,0.2) 40%, transparent 70%)' }}
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Bright core */}
          <motion.div
            className="absolute top-1 left-0 w-1.5 h-3 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,200,50,0.6) 0%, transparent 70%)' }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />
        </div>
      </div>
    </div>

    {/* Falling ash particles */}
    {[0, 1, 2].map((i) => (
      <motion.div
        key={`ash-${i}`}
        className="absolute rounded-full"
        style={{
          width: 2 + i, height: 2 + i * 0.5,
          bottom: 24, left: 88 + i * 3,
          backgroundColor: `rgba(120,120,120,${0.4 - i * 0.1})`,
        }}
        animate={{
          y: [0, 15 + i * 5, 30 + i * 8],
          x: [0, 4 + i * 2, 8 + i * 3],
          opacity: [0.5, 0.25, 0],
          rotate: [0, 45 + i * 30, 90 + i * 60],
        }}
        transition={{
          duration: 2.5 + i * 0.5,
          repeat: Infinity,
          delay: i * 1.5 + 0.5,
          ease: 'easeIn',
        }}
      />
    ))}
  </div>
);

const sensitiveTabs = [
  { id: 'asthma', label: 'Asthma/COPD', icon: Activity, threshold: 40 },
  { id: 'children', label: 'Children', icon: User, threshold: 50 },
  { id: 'elderly', label: 'Elderly', icon: User, threshold: 45 },
  { id: 'heart', label: 'Heart Patients', icon: Heart, threshold: 45 },
  { id: 'smokers', label: 'Smokers', icon: Wind, threshold: 60 },
];

const Health = () => {
  const active = useActiveNode();
  const [activeTab, setActiveTab] = useState(sensitiveTabs[0]);

  // Generate dynamic advisory using multi-factor model
  const advisory = useMemo(() => {
    if (!active.ready) return null;
    return generateAdvisory(active.sensors, active.environment, active.derived, activeTab.id);
  }, [active.ready, active.sensors, active.environment, active.derived, activeTab.id]);

  if (!active.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { derived, environment, sensors } = active;
  const rri = derived.rri || 0;
  const pm25 = sensors?.pm25 || 0;

  // Berkeley Earth methodology: 1 cigarette ≈ 22 µg/m³ PM2.5 over 24hrs
  const cigPerDay = Math.max(0, Math.round((pm25 / 22) * 10) / 10);
  const cigWeekly = Math.round(cigPerDay * 7);
  const cigMonthly = Math.round(cigPerDay * 30);

  const protectiveActions = [
    { icon: Fan, label: 'Air Purifier', status: pm25 > 35 ? 'Turn On' : 'Not Needed', active: pm25 > 35 },
    { icon: Shield, label: 'Mask', status: pm25 > 55 ? 'N95 Required' : pm25 > 35 ? 'Advisable' : 'Not Needed', active: pm25 > 35 },
    { icon: Home, label: 'Stay Indoor', status: pm25 > 100 ? 'Recommended' : 'Optional', active: pm25 > 100 },
    { icon: Wind, label: 'Ventilation', status: pm25 > 60 ? 'Keep Closed' : 'Open Windows', active: pm25 > 60, invert: true },
  ];

  return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Health Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {active.isNodeView ? `${active.nodeName} — ` : ''}Health guidance and recommendations based on current conditions.
          </p>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 rounded-xl text-[10px] font-semibold text-purple-400 self-start sm:self-auto">
          <Cpu size={10} /> Multi-Factor Advisory
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* Left */}
        <div className="xl:col-span-8 space-y-5">

          {/* Guidance cards — now using AI advisory data */}
          <div className="bg-white/[0.03] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-5">Current Guidance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                {
                  label: 'Respirator',
                  value: advisory?.maskType || 'Not needed',
                  icon: Shield,
                  color: advisory?.maskType?.includes('N95') ? 'text-amber-400' : advisory?.maskType?.includes('Surgical') ? 'text-yellow-400' : 'text-emerald-400',
                  bg: advisory?.maskType?.includes('N95') ? 'bg-amber-500/[0.06]' : 'bg-white/[0.02]',
                },
                {
                  label: 'Outdoor Limit',
                  value: advisory?.outdoorLimit || 'Unlimited',
                  icon: Thermometer,
                  color: 'text-sky-400',
                  bg: 'bg-white/[0.02]',
                },
                {
                  label: 'Daily Intake',
                  value: `${advisory?.hydrationOz || 84} oz water`,
                  icon: Droplets,
                  color: 'text-blue-400',
                  bg: 'bg-white/[0.02]',
                },
                {
                  label: 'Breathing',
                  value: rri >= 40 ? 'Shallow, indoor' : '4-7-8 Deep rhythm',
                  icon: Wind,
                  color: 'text-purple-400',
                  bg: 'bg-white/[0.02]',
                },
              ].map((g) => (
                <div key={g.label} className={`p-5 rounded-xl ${g.bg}`}>
                  <g.icon size={18} className={`${g.color} mb-3`} />
                  <p className="text-xs text-slate-500 mb-1">{g.label}</p>
                  <p className={`text-sm font-semibold ${g.color}`}>{g.value}</p>
                </div>
              ))}
            </div>

            {/* Dynamic warnings from advisory engine */}
            {advisory?.warnings?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-2">
                {advisory.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-amber-400">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center gap-2 text-sm text-slate-400">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>
                {rri < 40
                  ? 'Deep breathing exercises recommended. Air quality supports normal activity.'
                  : 'Switch to shallow, indoor breathing exercises. Minimize outdoor exertion.'}
              </span>
            </div>
          </div>

          {/* Cigarette Equivalent — Pollution Impact */}
          <div className="bg-white/[0.03] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-slate-300">Pollution Impact</h3>
              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                <Info size={10} />
                <span>Berkeley Earth Methodology</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
              {/* Animated cigarette */}
              <SmokingCigarette />

              {/* Daily count */}
              <div className="text-center sm:text-left">
                <div className="flex items-baseline gap-2">
                  <motion.span
                    key={cigPerDay}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-5xl font-extrabold tabular-nums ${cigPerDay >= 5 ? 'text-red-400' : cigPerDay >= 2 ? 'text-amber-400' : cigPerDay > 0 ? 'text-orange-400' : 'text-emerald-400'}`}
                  >
                    {cigPerDay}
                  </motion.span>
                  <span className="text-sm text-slate-500 leading-tight">Cigarettes<br/>per day</span>
                </div>
                <p className="text-xs text-slate-500 mt-3 max-w-xs leading-relaxed">
                  Breathing this air is equivalent to smoking{' '}
                  <span className="text-slate-300 font-medium">{cigPerDay} cigarette{cigPerDay !== 1 ? 's' : ''}</span>{' '}
                  daily based on current PM2.5 levels.
                </p>
              </div>

              {/* Weekly / Monthly */}
              <div className="flex sm:flex-col gap-6 sm:gap-4 sm:ml-auto">
                <div className="text-center">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Weekly</p>
                  <p className={`text-2xl font-bold tabular-nums ${cigWeekly >= 35 ? 'text-red-400' : 'text-amber-400'}`}>{cigWeekly}</p>
                  <p className="text-[10px] text-slate-600">cigarettes</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Monthly</p>
                  <p className={`text-2xl font-bold tabular-nums ${cigMonthly >= 100 ? 'text-red-400' : 'text-amber-400'}`}>{cigMonthly}</p>
                  <p className="text-[10px] text-slate-600">cigarettes</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 italic mt-5">
              This estimate uses the average PM2.5 concentration ({pm25.toFixed(1)} µg/m³) assuming continuous 24-hour exposure. 1 cigarette ≈ 22 µg/m³ PM2.5.
            </p>

            {/* Protective Actions */}
            <div className="mt-5 pt-5 border-t border-white/[0.05]">
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-3">Protective Actions</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {protectiveActions.map((a) => (
                  <div
                    key={a.label}
                    className={`p-4 rounded-xl transition-colors ${
                      a.active
                        ? a.invert ? 'bg-rose-500/[0.06]' : 'bg-sky-500/[0.06]'
                        : 'bg-white/[0.02]'
                    }`}
                  >
                    <a.icon size={18} className={`mb-2.5 ${a.active ? (a.invert ? 'text-rose-400' : 'text-sky-400') : 'text-slate-600'}`} />
                    <p className="text-xs font-medium text-slate-300">{a.label}</p>
                    <p className={`text-[11px] mt-0.5 ${a.active ? (a.invert ? 'text-rose-400' : 'text-sky-400') : 'text-slate-500'}`}>
                      {a.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sensitive Group Tabs */}
          <div className="bg-white/[0.03] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
              <h3 className="text-sm font-semibold text-slate-300">Sensitive Groups</h3>
              <div className="flex flex-wrap gap-1.5">
                {sensitiveTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      activeTab.id === tab.id
                        ? 'bg-sky-500/[0.12] text-sky-400'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className={`p-5 rounded-xl ${advisory?.isDanger ? 'bg-red-500/[0.04]' : 'bg-white/[0.02]'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    {advisory?.isDanger ? <AlertTriangle size={16} className="text-red-400" /> : <CheckCircle2 size={16} className="text-emerald-400" />}
                    <span className={`text-sm font-semibold ${advisory?.isDanger ? 'text-red-400' : 'text-emerald-400'}`}>
                      {advisory?.isDanger ? 'Caution Required' : 'Normal Activity OK'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Current RRI is {rri}. The {activeTab.label} threshold is {advisory?.groupThreshold || activeTab.threshold}.
                    {advisory?.isDanger
                      ? ' Conditions exceed safe levels for this group. Limit outdoor exposure.'
                      : ' Present conditions are within safe parameters.'}
                  </p>
                </div>

                {/* Dynamic per-group recommendations from AI engine */}
                <div className="p-5 rounded-xl bg-white/[0.02]">
                  <p className="text-xs text-slate-500 mb-3">Recommendations</p>
                  <ul className="space-y-2.5">
                    {(advisory?.recommendations || []).slice(0, 4).map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1 h-1 bg-sky-400 rounded-full mt-1.5 shrink-0" />
                        <span className="text-sm text-slate-300">{rec}</span>
                      </li>
                    ))}
                    {(!advisory?.recommendations || advisory.recommendations.length === 0) && (
                      <li className="flex items-start gap-2">
                        <span className="w-1 h-1 bg-sky-400 rounded-full mt-1.5 shrink-0" />
                        <span className="text-sm text-slate-300">No specific concerns for current conditions.</span>
                      </li>
                    )}
                  </ul>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right */}
        <div className="xl:col-span-4 space-y-5">

          {/* Emergency */}
          <div className="bg-red-500/[0.04] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Heart size={16} className="text-red-400" />
              <h3 className="text-sm font-semibold text-red-400">Emergency Signs</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Seek immediate medical help if experiencing:</p>
            <div className="space-y-2">
              {[
                'Severe shortness of breath',
                'Chest pain or tightness',
                'Prolonged dizziness',
                'Blue lips or fingertips',
                'Uncontrollable coughing',
              ].map((s) => (
                <div key={s} className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/[0.03]">
                  <AlertTriangle size={12} className="text-red-400 shrink-0" />
                  <span className="text-sm text-slate-300">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WHO Standards */}
          <div className="bg-white/[0.03] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">WHO Guidelines</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              WHO recommends annual PM2.5 averages below 5 µg/m³ and 24-hour exposures below 15 µg/m³.
            </p>
            <div className="p-3 bg-white/[0.02] rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">Current PM2.5</span>
                <span className={`text-xs font-semibold ${pm25 > 15 ? 'text-rose-400' : 'text-emerald-400'}`}>{pm25} µg/m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">WHO 24hr Limit</span>
                <span className="text-xs font-semibold text-emerald-400">15 µg/m³</span>
              </div>
              <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-rose-500 rounded-full"
                  style={{ width: `${Math.min((pm25 / 15) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">India NAAQS 24hr</span>
                <span className="text-xs font-semibold text-sky-400">60 µg/m³</span>
              </div>
              <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 rounded-full"
                  style={{ width: `${Math.min((pm25 / 60) * 100, 100)}%` }}
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
