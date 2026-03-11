import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Shield, AlertTriangle, Activity, Thermometer,
  Droplets, Wind, User, CheckCircle2, Cpu, Fan, Home, Info, Car
} from 'lucide-react';
import useActiveNode from '@/hooks/useActiveNode';
import { generateAdvisory } from '@/utils/aqiEngine';

// Smoke wisps config — staggered, drifting, soft-fade for organic realism
const smokeWisps = [
  { w: 22, h: 18, xEnd: -14, rise: -80, dur: 3.4, delay: 0, ox: 0, blur: 8, op: 0.3 },
  { w: 30, h: 22, xEnd: 10, rise: -100, dur: 4.0, delay: 0.6, ox: 4, blur: 10, op: 0.22 },
  { w: 18, h: 14, xEnd: -20, rise: -65, dur: 2.8, delay: 1.2, ox: -2, blur: 6, op: 0.35 },
  { w: 36, h: 26, xEnd: 16, rise: -115, dur: 4.6, delay: 0.3, ox: 2, blur: 13, op: 0.16 },
  { w: 14, h: 12, xEnd: -8, rise: -50, dur: 2.2, delay: 0.9, ox: 6, blur: 5, op: 0.38 },
  { w: 26, h: 20, xEnd: 12, rise: -90, dur: 3.8, delay: 1.8, ox: -4, blur: 9, op: 0.25 },
  { w: 42, h: 28, xEnd: -6, rise: -130, dur: 5.2, delay: 1.4, ox: 0, blur: 16, op: 0.1 },
  { w: 20, h: 16, xEnd: 18, rise: -70, dur: 3.0, delay: 2.2, ox: 3, blur: 7, op: 0.28 },
];

const CigaretteIcon = () => (
  <div className="relative shrink-0" style={{ width: 160, height: 120 }}>
    {/* Smoke */}
    {smokeWisps.map((s, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          width: s.w, height: s.h,
          bottom: 72, left: 108 + s.ox,
          filter: `blur(${s.blur}px)`,
          background: `radial-gradient(ellipse, rgba(160,175,195,${s.op}) 0%, transparent 70%)`,
        }}
        animate={{
          y: [0, s.rise * 0.35, s.rise],
          x: [0, s.xEnd * 0.5, s.xEnd],
          opacity: [0, s.op, 0],
          scale: [0.4, 1.2, 2.4],
        }}
        transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeOut' }}
      />
    ))}

    {/* Cigarette body — slight tilt */}
    <div className="absolute bottom-4 left-6" style={{ transform: 'rotate(-8deg)' }}>
      <div className="flex items-center">
        {/* Filter */}
        <div className="relative overflow-hidden rounded-l-sm" style={{ width: 30, height: 12 }}>
          <div className="absolute inset-0 bg-gradient-to-b from-amber-600 to-amber-800" />
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 2px, rgba(0,0,0,0.12) 2px 3px)',
          }} />
        </div>
        {/* Paper */}
        <div className="relative overflow-hidden" style={{ width: 72, height: 12 }}>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-100 to-slate-200" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.08) 3px 4px)',
          }} />
        </div>
        {/* Ash */}
        <div style={{ width: 6, height: 12 }} className="bg-gradient-to-r from-slate-300 to-slate-400" />
        {/* Ember */}
        <div className="relative" style={{ width: 5, height: 12 }}>
          <div className="absolute inset-0 rounded-r-sm bg-gradient-to-r from-orange-500 to-red-600" />
          <motion.div
            className="absolute -inset-1.5 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.5) 0%, transparent 70%)' }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
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

  const solutions = [
    { icon: Fan, label: 'Air Purifier', status: pm25 > 35 ? 'Turn On' : 'Turn Off', active: pm25 > 35 },
    { icon: Car, label: 'Car Filter', status: pm25 > 25 ? 'Advisable' : 'Optional', active: pm25 > 25 },
    { icon: Shield, label: 'N95 Mask', status: pm25 > 55 ? 'Required' : pm25 > 35 ? 'Advisable' : 'Not Needed', active: pm25 > 35 },
    { icon: Home, label: 'Stay Indoor', status: pm25 > 100 ? 'Advisable' : 'Optional', active: pm25 > 100 },
  ];

  return (
    <div className="p-6 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-xl font-bold text-(--color-text-primary) tracking-tight">Health Center</h1>
          <p className="text-sm text-(--color-text-secondary) mt-0.5">
            {active.isNodeView ? `${active.nodeName} — ` : ''}Health guidance and recommendations based on current conditions.
          </p>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 rounded-xl text-xs font-semibold text-purple-400 self-start sm:self-auto">
          <Cpu size={10} /> Multi-Factor Advisory
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* Left */}
        <div className="xl:col-span-8 space-y-5">

          {/* Guidance cards — now using AI advisory data */}
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold text-(--color-text-primary) mb-5">Current Guidance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                {
                  label: 'Respirator',
                  value: advisory?.maskType || 'Not needed',
                  icon: Shield,
                  color: advisory?.maskType?.includes('N95') ? 'text-amber-400' : advisory?.maskType?.includes('Surgical') ? 'text-yellow-400' : 'text-emerald-400',
                  bg: advisory?.maskType?.includes('N95') ? 'bg-amber-500/[0.06]' : 'bg-white/10',
                },
                {
                  label: 'Outdoor Limit',
                  value: advisory?.outdoorLimit || 'Unlimited',
                  icon: Thermometer,
                  color: 'text-sky-400',
                  bg: 'bg-white/10',
                },
                {
                  label: 'Daily Intake',
                  value: `${advisory?.hydrationOz || 84} oz water`,
                  icon: Droplets,
                  color: 'text-blue-400',
                  bg: 'bg-white/10',
                },
                {
                  label: 'Breathing',
                  value: rri >= 40 ? 'Shallow, indoor' : '4-7-8 Deep rhythm',
                  icon: Wind,
                  color: 'text-purple-400',
                  bg: 'bg-white/10',
                },
              ].map((g) => (
                <div key={g.label} className={`p-5 rounded-xl ${g.bg}`}>
                  <g.icon size={18} className={`${g.color} mb-3`} />
                  <p className="text-xs text-(--color-text-secondary) mb-1">{g.label}</p>
                  <p className={`text-sm font-semibold ${g.color}`}>{g.value}</p>
                </div>
              ))}
            </div>

            {/* Dynamic warnings from advisory engine */}
            {advisory?.warnings?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-(--color-card-border) space-y-2">
                {advisory.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-amber-400">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-(--color-card-border) flex items-center gap-2 text-sm text-slate-400">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>
                {rri < 40
                  ? 'Deep breathing exercises recommended. Air quality supports normal activity.'
                  : 'Switch to shallow, indoor breathing exercises. Minimize outdoor exertion.'}
              </span>
            </div>
          </div>

          {/* Cigarette Equivalent — Pollution Exposure */}
          <div className="glass-card overflow-hidden">

            {/* Top section: Number + Cigarette + Weekly/Monthly */}
            <div className="p-6 pb-5">
              <div className="flex flex-col md:flex-row items-center gap-5 md:gap-0">

                {/* Left: Big number + label */}
                <div className="flex items-center gap-5 md:flex-1">
                  <div>
                    <motion.div
                      key={cigPerDay}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      className="flex items-baseline gap-1"
                    >
                      <span className={`text-6xl sm:text-7xl lg:text-5xl font-extrabold tabular-nums tracking-tight ${cigPerDay >= 5 ? 'text-red-400' : cigPerDay >= 2 ? 'text-amber-400' : cigPerDay > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {cigPerDay}
                      </span>
                    </motion.div>
                    <p className={`text-sm font-semibold mt-1 ${cigPerDay >= 5 ? 'text-red-400/80' : cigPerDay >= 2 ? 'text-amber-400/80' : cigPerDay > 0 ? 'text-orange-400/80' : 'text-emerald-400/80'}`}>
                      Cigarettes<br/>per day
                    </p>
                  </div>

                  {/* Cigarette animation */}
                  <CigaretteIcon />
                </div>

                {/* Right: Weekly / Monthly stats */}
                <div className="flex md:flex-col gap-8 md:gap-5 md:items-end">
                  <div className="text-center md:text-right">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Weekly</p>
                    <p className={`text-3xl lg:text-2xl font-bold tabular-nums mt-0.5 ${cigWeekly >= 35 ? 'text-red-400' : 'text-amber-400'}`}>{cigWeekly}</p>
                    <p className="text-xs text-slate-600">Cigarettes</p>
                  </div>
                  <div className="text-center md:text-right">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Monthly</p>
                    <p className={`text-3xl lg:text-2xl font-bold tabular-nums mt-0.5 ${cigMonthly >= 100 ? 'text-red-400' : 'text-amber-400'}`}>{cigMonthly}</p>
                    <p className="text-xs text-slate-600">Cigarettes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description callout */}
            <div className="px-6 pb-4">
              <p className="text-sm text-slate-400 leading-relaxed">
                Breathing the air in this location is as harmful as smoking{' '}
                <span className="text-white font-semibold">{cigPerDay} cigarette{cigPerDay !== 1 ? 's' : ''}</span> a day.
              </p>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-slate-600 italic leading-relaxed max-w-md">
                  This cigarette-equivalent estimate is based on the average PM2.5 concentration ({pm25.toFixed(1)} µg/m³) over the last 24 hours, assuming continuous exposure during that time.
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0 ml-4">
                  <span>Source:</span>
                  <span className="text-slate-400 font-medium">Berkeley Earth</span>
                  <Info size={10} className="text-slate-600" />
                </div>
              </div>
            </div>

            {/* Solutions section */}
            <div className="px-6 pt-4 pb-6 border-t border-(--color-card-border)">
              <h4 className="text-base font-semibold text-(--color-text-primary) mb-4">Solutions for Current AQI</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Solution cards */}
                <div className="flex gap-2.5 flex-1 overflow-x-auto pb-1">
                  {solutions.map((s, i) => (
                    <button
                      key={s.label}
                      className={`flex-1 min-w-[100px] flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                        s.active
                          ? 'bg-sky-500/[0.06] ring-1 ring-sky-500/20'
                          : 'bg-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.active ? 'bg-sky-500/10' : 'bg-white/10'}`}>
                        <s.icon size={20} className={s.active ? 'text-sky-400' : 'text-slate-500'} strokeWidth={1.5} />
                      </div>
                      <span className={`text-xs font-medium ${s.active ? 'text-white' : 'text-slate-400'}`}>{s.label}</span>
                      <span className={`text-xs ${s.active ? 'text-sky-400' : 'text-slate-600'}`}>{s.status}</span>
                    </button>
                  ))}
                </div>

                {/* Context description */}
                <div className="sm:w-56 sm:pl-4 sm:border-l sm:border-white/[0.04] flex flex-col justify-center">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {pm25 > 55
                      ? 'Air quality is poor. Use an N95 mask outdoors and run air purifiers indoors.'
                      : pm25 > 35
                      ? 'As per the current AQI, wearing a mask outdoors and using air filtration is advisable.'
                      : 'Air quality is within safe limits. Normal activities can continue.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sensitive Group Tabs */}
          <div className="glass-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
              <h3 className="text-base font-semibold text-(--color-text-primary)">Sensitive Groups</h3>
              <div className="flex flex-wrap gap-1.5">
                {sensitiveTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      activeTab.id === tab.id
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
                key={activeTab.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className={`p-5 rounded-xl ${advisory?.isDanger ? 'bg-red-500/[0.04]' : 'bg-white/10'}`}>
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
                <div className="p-5 rounded-xl bg-white/10">
                  <p className="text-xs text-(--color-text-secondary) mb-3">Recommendations</p>
                  <ul className="space-y-2.5">
                    {(advisory?.recommendations || []).slice(0, 4).map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1 h-1 bg-sky-400 rounded-full mt-1.5 shrink-0" />
                        <span className="text-sm text-(--color-text-primary)">{rec}</span>
                      </li>
                    ))}
                    {(!advisory?.recommendations || advisory.recommendations.length === 0) && (
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
        </div>

        {/* Right */}
        <div className="xl:col-span-4 space-y-5">

          {/* Emergency */}
          <div className="glass-card bg-red-500/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Heart size={16} className="text-red-400" />
              <h3 className="text-base font-semibold text-red-400">Emergency Signs</h3>
            </div>
            <p className="text-xs text-(--color-text-secondary) mb-4">Seek immediate medical help if experiencing:</p>
            <div className="space-y-2">
              {[
                'Severe shortness of breath',
                'Chest pain or tightness',
                'Prolonged dizziness',
                'Blue lips or fingertips',
                'Uncontrollable coughing',
              ].map((s) => (
                <div key={s} className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/5">
                  <AlertTriangle size={12} className="text-red-400 shrink-0" />
                  <span className="text-sm text-(--color-text-primary)">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WHO Standards */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-(--color-text-primary) mb-3">WHO Guidelines</h3>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-4">
              WHO recommends annual PM2.5 averages below 5 µg/m³ and 24-hour exposures below 15 µg/m³.
            </p>
            <div className="p-3 bg-white/10 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-(--color-text-secondary)">Current PM2.5</span>
                <span className={`text-xs font-semibold ${pm25 > 15 ? 'text-rose-400' : 'text-emerald-400'}`}>{pm25} µg/m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-(--color-text-secondary)">WHO 24hr Limit</span>
                <span className="text-xs font-semibold text-emerald-400">15 µg/m³</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-rose-500 rounded-full"
                  style={{ width: `${Math.min((pm25 / 15) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-(--color-text-secondary)">India NAAQS 24hr</span>
                <span className="text-xs font-semibold text-sky-400">60 µg/m³</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1">
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
