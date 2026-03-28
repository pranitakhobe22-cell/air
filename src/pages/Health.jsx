import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, Shield, AlertTriangle, Activity, Thermometer,
  Droplets, Wind, User, CheckCircle2, Cpu, Fan, Home, Info, Car,
  Stethoscope, Baby, PersonStanding, HeartPulse, Cigarette, Bike, Clock
} from 'lucide-react';
import useActiveNode from '@/hooks/useActiveNode';
import useAuthStore from '@/store/useAuthStore';
import aerisApi from '@/services/aerisApi';
import { generateAdvisory } from '@/utils/aqiEngine';

// ── Load user health profile from backend ────────────────────
function useHealthProfile() {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    aerisApi.get(`/profile/${user.id}`)
      .then(r => { if (r.data?.success) setProfile(r.data.data); })
      .catch(() => {});
  }, [user?.id]);

  // Fallback defaults if profile not loaded
  return profile || {
    age: 28, gender: 'prefer_not_to_say', smoking: 'none',
    conditions: [], sensitivity: 'moderate', outdoorExposureHours: 3,
    activityLevel: 'moderate', commuteMode: 'mixed', environment: 'suburban',
  };
}

// ── Personalized risk multiplier from profile ────────────────
function personalRisk(profile, aqi) {
  let mod = 1.0;
  if (profile.age < 12) mod += 0.3;
  else if (profile.age > 65) mod += 0.35;
  if (profile.conditions?.includes('Asthma')) mod += 0.45;
  if (profile.conditions?.includes('COPD')) mod += 0.55;
  if (profile.conditions?.includes('Heart Disease')) mod += 0.4;
  if (profile.conditions?.includes('Diabetes')) mod += 0.2;
  if (profile.conditions?.includes('Allergies')) mod += 0.15;
  if (profile.conditions?.includes('Immunocompromised')) mod += 0.35;
  if (profile.smoking === 'heavy') mod += 0.35;
  else if (profile.smoking === 'light') mod += 0.2;
  if (profile.activityLevel === 'very_active') mod += 0.25;
  else if (profile.activityLevel === 'active') mod += 0.15;
  if (profile.commuteMode === 'biking' || profile.commuteMode === 'walking') mod += 0.2;
  if (profile.environment === 'urban') mod += 0.15;
  else if (profile.environment === 'industrial') mod += 0.25;
  const personalRri = Math.min(100, Math.round(aqi * mod));
  return { modifier: mod, personalRri };
}

// ── Generate personalized precautions ────────────────────────
function getPersonalPrecautions(profile, pm25, aqi, rri) {
  const precautions = [];
  const isDangerous = aqi > 100;
  const isModerate = aqi > 50;

  // Age-based
  if (profile.age < 12) {
    precautions.push({ icon: Baby, text: 'Children are more vulnerable — limit outdoor play to 30 min max during elevated AQI', active: isModerate });
    precautions.push({ icon: Home, text: 'Keep indoor air clean with HEPA filters in children\'s rooms', active: isDangerous });
  } else if (profile.age > 65) {
    precautions.push({ icon: PersonStanding, text: 'Elderly individuals should avoid strenuous outdoor activity', active: isModerate });
    precautions.push({ icon: Heart, text: 'Monitor blood pressure more frequently during high pollution days', active: isDangerous });
  }

  // Condition-based
  if (profile.conditions?.includes('Asthma')) {
    precautions.push({ icon: Stethoscope, text: 'Keep rescue inhaler accessible at all times', active: true });
    precautions.push({ icon: Wind, text: 'Pre-medicate before any outdoor activity today', active: isModerate });
    if (isDangerous) precautions.push({ icon: AlertTriangle, text: 'Asthma attack risk elevated — stay indoors with air purifier', active: true });
  }
  if (profile.conditions?.includes('COPD')) {
    precautions.push({ icon: Stethoscope, text: 'COPD: Use supplemental oxygen if prescribed during high AQI', active: isDangerous });
    precautions.push({ icon: Home, text: 'Avoid all outdoor exertion — COPD patients face 2x risk', active: isModerate });
  }
  if (profile.conditions?.includes('Heart Disease')) {
    precautions.push({ icon: HeartPulse, text: 'Heart patients: PM2.5 increases cardiovascular stress — limit exertion', active: isModerate });
    precautions.push({ icon: AlertTriangle, text: 'Watch for chest tightness, irregular heartbeat, or unusual fatigue', active: isDangerous });
  }
  if (profile.conditions?.includes('Diabetes')) {
    precautions.push({ icon: Activity, text: 'Diabetes: High pollution increases inflammation — monitor glucose closely', active: isModerate });
  }
  if (profile.conditions?.includes('Allergies')) {
    precautions.push({ icon: Droplets, text: 'Allergy sufferers: Use nasal saline rinse after outdoor exposure', active: isModerate });
    precautions.push({ icon: Shield, text: 'Antihistamines recommended before going outdoors today', active: isDangerous });
  }
  if (profile.conditions?.includes('Immunocompromised')) {
    precautions.push({ icon: Shield, text: 'Immunocompromised: N95 mask mandatory for any outdoor activity', active: isModerate });
  }

  // Smoking
  if (profile.smoking === 'heavy') {
    precautions.push({ icon: Cigarette, text: 'Heavy smoker: Your lungs are already compromised — avoid all outdoor exposure during poor AQI', active: isModerate });
  } else if (profile.smoking === 'light') {
    precautions.push({ icon: Cigarette, text: 'Smoking + pollution compounds lung damage — consider reducing intake on high AQI days', active: isModerate });
  }

  // Activity
  if (profile.activityLevel === 'very_active' || profile.activityLevel === 'active') {
    precautions.push({ icon: Activity, text: 'Active lifestyle: Shift outdoor exercise to early morning (5-7 AM) when AQI is lowest', active: isModerate });
  }

  // Commute
  if (profile.commuteMode === 'biking' || profile.commuteMode === 'walking') {
    precautions.push({ icon: Bike, text: `${profile.commuteMode === 'biking' ? 'Cycling' : 'Walking'} commute: Wear N95 mask, inhaling 3-5x more air than at rest`, active: isModerate });
  }

  // General always-on
  precautions.push({ icon: Droplets, text: `Drink ${pm25 > 55 ? '3-4' : '2-3'} liters of water today to support mucus clearance`, active: true });
  precautions.push({ icon: Thermometer, text: 'Avoid combining heat exposure with poor air quality — compounds cardiac stress', active: isModerate });

  return precautions;
}

// ── Personalized remedies ────────────────────────────────────
function getRemedies(profile, pm25, aqi) {
  const remedies = [];
  const hasRespiratory = profile.conditions?.some(c => ['Asthma', 'COPD', 'Allergies'].includes(c));
  const hasCardiac = profile.conditions?.includes('Heart Disease');

  remedies.push({
    title: 'Breathing Exercise',
    desc: hasRespiratory
      ? 'Pursed-lip breathing: Inhale 2s through nose, exhale 4s through pursed lips. Reduces air trapping in lungs.'
      : aqi > 100 ? 'Box breathing: 4s inhale, 4s hold, 4s exhale, 4s hold. Reduces anxiety and controls respiration rate.'
      : '4-7-8 technique: Inhale 4s, hold 7s, exhale 8s. Promotes deep relaxation and lung capacity.',
    icon: Wind,
    color: 'text-purple-400',
    active: true,
  });

  remedies.push({
    title: 'Dietary Support',
    desc: hasRespiratory
      ? 'Anti-inflammatory foods: turmeric milk, ginger tea, omega-3 rich fish. Vitamin C (citrus) boosts mucosal immunity.'
      : hasCardiac
      ? 'Heart-protective diet: leafy greens, berries, nuts, olive oil. Avoid excess sodium on high pollution days.'
      : 'Antioxidant-rich foods: broccoli, spinach, berries, green tea. These help neutralize pollution-induced oxidative stress.',
    icon: HeartPulse,
    color: 'text-emerald-400',
    active: true,
  });

  remedies.push({
    title: 'Indoor Air',
    desc: pm25 > 55
      ? 'Run HEPA air purifier in all occupied rooms. Seal windows with damp towels if no purifier available. Use indoor plants (snake plant, peace lily).'
      : 'Keep windows closed during peak traffic hours (8-10 AM, 5-8 PM). Open briefly for ventilation during midday lull.',
    icon: Home,
    color: 'text-sky-400',
    active: pm25 > 25,
  });

  remedies.push({
    title: 'Nasal Care',
    desc: hasRespiratory || profile.conditions?.includes('Allergies')
      ? 'Saline nasal irrigation after every outdoor trip. Use nasal corticosteroid spray as prescribed. Apply coconut oil inside nostrils as a barrier.'
      : 'Rinse nasal passages with saline after extended outdoor exposure. Helps clear trapped particulates.',
    icon: Stethoscope,
    color: 'text-cyan-400',
    active: aqi > 50,
  });

  if (profile.smoking !== 'none') {
    remedies.push({
      title: 'Lung Recovery',
      desc: 'Steam inhalation with eucalyptus oil 2x daily. Consider NAC (N-Acetyl Cysteine) supplement — supports mucus clearance. Gradually reduce smoking exposure.',
      icon: Activity,
      color: 'text-amber-400',
      active: true,
    });
  }

  return remedies;
}

// ── Smoke Wisps (cigarette animation) ────────────────────────
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
    {smokeWisps.map((s, i) => (
      <motion.div key={i} className="absolute rounded-full"
        style={{ width: s.w, height: s.h, bottom: 72, left: 108 + s.ox, filter: `blur(${s.blur}px)`, background: `radial-gradient(ellipse, rgba(160,175,195,${s.op}) 0%, transparent 70%)` }}
        animate={{ y: [0, s.rise * 0.35, s.rise], x: [0, s.xEnd * 0.5, s.xEnd], opacity: [0, s.op, 0], scale: [0.4, 1.2, 2.4] }}
        transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeOut' }}
      />
    ))}
    <div className="absolute bottom-4 left-6" style={{ transform: 'rotate(-8deg)' }}>
      <div className="flex items-center">
        <div className="relative overflow-hidden rounded-l-sm" style={{ width: 30, height: 12 }}><div className="absolute inset-0 bg-gradient-to-b from-amber-600 to-amber-800" /><div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 2px, rgba(0,0,0,0.12) 2px 3px)' }} /></div>
        <div className="relative overflow-hidden" style={{ width: 72, height: 12 }}><div className="absolute inset-0 bg-gradient-to-b from-slate-100 to-slate-200" /></div>
        <div style={{ width: 6, height: 12 }} className="bg-gradient-to-r from-slate-300 to-slate-400" />
        <div className="relative" style={{ width: 5, height: 12 }}><div className="absolute inset-0 rounded-r-sm bg-gradient-to-r from-orange-500 to-red-600" /><motion.div className="absolute -inset-1.5 rounded-full" style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.5) 0%, transparent 70%)' }} animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} /></div>
      </div>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
const Health = () => {
  const active = useActiveNode();
  const user = useAuthStore((s) => s.user);
  const profile = useHealthProfile();

  const advisory = useMemo(() => {
    if (!active.ready) return null;
    return generateAdvisory(active.sensors, active.environment, active.derived, 'asthma');
  }, [active.ready, active.sensors, active.environment, active.derived]);

  if (!active.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { derived, environment, sensors } = active;
  const rri = derived.rri || 0;
  const aqi = derived.aqi || 0;
  const pm25 = sensors?.pm25 || 0;
  const { modifier, personalRri } = personalRisk(profile, aqi);

  const cigPerDay = Math.max(0, Math.round((pm25 / 22) * 10) / 10);
  const cigWeekly = Math.round(cigPerDay * 7);
  const cigMonthly = Math.round(cigPerDay * 30);

  const precautions = getPersonalPrecautions(profile, pm25, aqi, rri);
  const remedies = getRemedies(profile, pm25, aqi);

  const solutions = [
    { icon: Fan, label: 'Air Purifier', status: pm25 > 35 ? 'Turn On' : 'Turn Off', active: pm25 > 35 },
    { icon: Car, label: 'Car Filter', status: pm25 > 25 ? 'Advisable' : 'Optional', active: pm25 > 25 },
    { icon: Shield, label: 'N95 Mask', status: pm25 > 55 ? 'Required' : pm25 > 35 ? 'Advisable' : 'Not Needed', active: pm25 > 35 },
    { icon: Home, label: 'Stay Indoor', status: pm25 > 100 ? 'Advisable' : 'Optional', active: pm25 > 100 },
  ];

  const profileTags = [
    profile.age < 18 ? 'Child' : profile.age > 65 ? 'Elderly' : null,
    ...(profile.conditions || []),
    profile.smoking !== 'none' ? `Smoker (${profile.smoking})` : null,
    profile.activityLevel === 'very_active' ? 'Very Active' : profile.activityLevel === 'active' ? 'Active' : null,
  ].filter(Boolean);

  return (
    <div className="p-6 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-xl font-bold text-(--color-text-primary) tracking-tight">
            Health Center {user?.name ? `— ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-0.5">
            Personalised health guidance based on your profile and live air quality data.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {profileTags.length > 0 && profileTags.map(tag => (
            <span key={tag} className="px-2.5 py-1 bg-purple-500/10 rounded-lg text-[10px] font-bold text-purple-400 uppercase tracking-wider border border-purple-500/20">
              {tag}
            </span>
          ))}
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 rounded-lg text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
            <Cpu size={10} /> Risk ×{modifier.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* Left */}
        <div className="xl:col-span-8 space-y-5">

          {/* Personalised Guidance */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <User size={16} className="text-(--color-accent)" />
              <h3 className="text-base font-semibold text-(--color-text-primary)">Your Personalised Guidance</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                {
                  label: 'Your Risk Score',
                  value: `${personalRri}/100`,
                  icon: HeartPulse,
                  color: personalRri >= 60 ? 'text-red-400' : personalRri >= 40 ? 'text-amber-400' : 'text-emerald-400',
                  bg: personalRri >= 60 ? 'bg-red-500/[0.06]' : 'bg-white/10',
                },
                {
                  label: 'Respirator',
                  value: advisory?.maskType || (pm25 > 55 ? 'N95 Required' : pm25 > 35 ? 'Surgical Mask' : 'Not needed'),
                  icon: Shield,
                  color: pm25 > 55 ? 'text-amber-400' : pm25 > 35 ? 'text-yellow-400' : 'text-emerald-400',
                  bg: pm25 > 55 ? 'bg-amber-500/[0.06]' : 'bg-white/10',
                },
                {
                  label: 'Outdoor Limit',
                  value: personalRri >= 60 ? 'Avoid outdoor' : personalRri >= 40 ? '< 30 min' : advisory?.outdoorLimit || 'Unlimited',
                  icon: Clock,
                  color: personalRri >= 60 ? 'text-red-400' : 'text-sky-400',
                  bg: 'bg-white/10',
                },
                {
                  label: 'Hydration',
                  value: `${pm25 > 55 ? '3.5' : pm25 > 35 ? '3' : '2.5'}L water`,
                  icon: Droplets,
                  color: 'text-blue-400',
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
          </div>

          {/* Personalised Precautions */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Shield size={16} className="text-amber-400" />
              <h3 className="text-base font-semibold text-(--color-text-primary)">Your Precautions</h3>
              <span className="text-[10px] text-(--color-text-secondary) ml-auto">Based on your health profile</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {precautions.map((p, i) => (
                <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl transition-colors ${p.active ? 'bg-amber-500/5 border border-amber-500/10' : 'subtle-surface border border-transparent'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${p.active ? 'bg-amber-500/10' : 'bg-white/10'}`}>
                    <p.icon size={14} className={p.active ? 'text-amber-400' : 'text-(--color-text-secondary) opacity-40'} />
                  </div>
                  <span className={`text-xs leading-relaxed ${p.active ? 'text-(--color-text-primary)' : 'text-(--color-text-secondary) opacity-60'}`}>{p.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Personalised Remedies */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Stethoscope size={16} className="text-emerald-400" />
              <h3 className="text-base font-semibold text-(--color-text-primary)">Remedies for You</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {remedies.map((r, i) => (
                <div key={i} className={`p-5 rounded-xl ${r.active ? 'subtle-surface' : 'bg-white/5'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <r.icon size={16} className={r.color} />
                    <h4 className="text-sm font-semibold text-(--color-text-primary)">{r.title}</h4>
                  </div>
                  <p className="text-xs text-(--color-text-secondary) leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cigarette Equivalent */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 pb-5">
              <div className="flex flex-col md:flex-row items-center gap-5 md:gap-0">
                <div className="flex items-center gap-5 md:flex-1">
                  <div>
                    <motion.div key={cigPerDay} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="flex items-baseline gap-1">
                      <span className={`text-6xl sm:text-7xl lg:text-5xl font-extrabold tabular-nums tracking-tight ${cigPerDay >= 5 ? 'text-red-400' : cigPerDay >= 2 ? 'text-amber-400' : cigPerDay > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>{cigPerDay}</span>
                    </motion.div>
                    <p className={`text-sm font-semibold mt-1 ${cigPerDay >= 5 ? 'text-red-400/80' : cigPerDay >= 2 ? 'text-amber-400/80' : cigPerDay > 0 ? 'text-orange-400/80' : 'text-emerald-400/80'}`}>Cigarettes<br/>per day</p>
                  </div>
                  <CigaretteIcon />
                </div>
                <div className="flex md:flex-col gap-8 md:gap-5 md:items-end">
                  <div className="text-center md:text-right"><p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Weekly</p><p className={`text-3xl lg:text-2xl font-bold tabular-nums mt-0.5 ${cigWeekly >= 35 ? 'text-red-400' : 'text-amber-400'}`}>{cigWeekly}</p></div>
                  <div className="text-center md:text-right"><p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Monthly</p><p className={`text-3xl lg:text-2xl font-bold tabular-nums mt-0.5 ${cigMonthly >= 100 ? 'text-red-400' : 'text-amber-400'}`}>{cigMonthly}</p></div>
                </div>
              </div>
            </div>
            <div className="px-6 pb-4">
              <p className="text-sm text-slate-400 leading-relaxed">Breathing the air here is as harmful as smoking <span className="text-white font-semibold">{cigPerDay} cigarette{cigPerDay !== 1 ? 's' : ''}</span> a day.</p>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-slate-600 italic leading-relaxed max-w-md">Based on PM2.5 ({pm25.toFixed(1)} µg/m³) × your vulnerability modifier (×{modifier.toFixed(1)}).</p>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0 ml-4"><span>Source:</span><span className="text-slate-400 font-medium">Berkeley Earth</span><Info size={10} /></div>
              </div>
            </div>

            <div className="px-6 pt-4 pb-6 border-t border-(--color-card-border)">
              <h4 className="text-base font-semibold text-(--color-text-primary) mb-4">Solutions for You</h4>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {solutions.map((s) => (
                  <button key={s.label} className={`flex-1 min-w-[100px] flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${s.active ? 'bg-sky-500/[0.06] ring-1 ring-sky-500/20' : 'bg-white/10'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.active ? 'bg-sky-500/10' : 'bg-white/10'}`}>
                      <s.icon size={20} className={s.active ? 'text-sky-400' : 'text-slate-500'} strokeWidth={1.5} />
                    </div>
                    <span className={`text-xs font-medium ${s.active ? 'text-(--color-text-primary)' : 'text-slate-400'}`}>{s.label}</span>
                    <span className={`text-xs ${s.active ? 'text-sky-400' : 'text-slate-600'}`}>{s.status}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="xl:col-span-4 space-y-5">

          {/* Your Risk Profile */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <HeartPulse size={16} className="text-(--color-accent)" />
              <h3 className="text-base font-semibold text-(--color-text-primary)">Your Risk Profile</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Personal RRI', value: personalRri, max: 100, color: personalRri > 60 ? '#ef4444' : personalRri > 40 ? '#f97316' : personalRri > 20 ? '#eab308' : '#22c55e' },
                { label: 'Base AQI', value: aqi, max: 500, color: aqi > 150 ? '#ef4444' : aqi > 100 ? '#f97316' : aqi > 50 ? '#eab308' : '#22c55e' },
                { label: 'PM2.5', value: pm25, max: 150, color: pm25 > 55 ? '#ef4444' : pm25 > 35 ? '#f97316' : pm25 > 12 ? '#eab308' : '#22c55e' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-(--color-text-secondary)">{item.label}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: item.color }}>{Math.round(item.value)}</span>
                  </div>
                  <div className="h-1.5 subtle-surface rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-(--color-card-border) space-y-2">
              <div className="flex justify-between text-xs"><span className="text-(--color-text-secondary)">Vulnerability</span><span className="font-semibold text-(--color-text-primary)">×{modifier.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-(--color-text-secondary)">Outdoor Exposure</span><span className="font-semibold text-(--color-text-primary)">{profile.outdoorExposureHours}h/day</span></div>
              <div className="flex justify-between text-xs"><span className="text-(--color-text-secondary)">Activity Level</span><span className="font-semibold text-(--color-text-primary) capitalize">{profile.activityLevel?.replace('_', ' ')}</span></div>
              <div className="flex justify-between text-xs"><span className="text-(--color-text-secondary)">Dominant Pollutant</span><span className="font-semibold text-(--color-text-primary)">{derived.dominant || 'PM2.5'}</span></div>
            </div>
          </div>

          {/* Emergency Signs */}
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
                ...(profile.conditions?.includes('Asthma') ? ['Rescue inhaler not relieving symptoms'] : []),
                ...(profile.conditions?.includes('Heart Disease') ? ['Irregular heartbeat lasting > 5 min'] : []),
              ].map((s) => (
                <div key={s} className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/5">
                  <AlertTriangle size={12} className="text-red-400 shrink-0" />
                  <span className="text-sm text-(--color-text-primary)">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Protection Tips */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-sky-400" />
              <h3 className="text-base font-semibold text-(--color-text-primary)">Quick Tips</h3>
            </div>
            <div className="space-y-2">
              {[
                { tip: 'Keep windows closed during high AQI', active: pm25 > 35 },
                { tip: 'Use HEPA purifiers in living spaces', active: pm25 > 25 },
                { tip: 'Stay hydrated — aids mucus clearance', active: true },
                { tip: 'Avoid outdoor exercise when AQI > 100', active: aqi > 100 },
                { tip: 'Monitor symptoms: coughing, eye irritation', active: rri > 40 },
              ].map((item) => (
                <div key={item.tip} className={`flex items-start gap-2.5 p-2.5 rounded-xl ${item.active ? 'bg-sky-500/5' : 'subtle-surface'}`}>
                  <CheckCircle2 size={13} className={`shrink-0 mt-0.5 ${item.active ? 'text-sky-400' : 'text-(--color-text-secondary) opacity-30'}`} />
                  <span className={`text-sm ${item.active ? 'text-(--color-text-primary)' : 'text-(--color-text-secondary) opacity-50'}`}>{item.tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Health;
