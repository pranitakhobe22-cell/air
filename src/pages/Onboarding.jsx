import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight, Heart, Wind, Clock, ChevronRight, Sparkles, Activity, Droplets, Eye } from 'lucide-react';
import aerisApi from '@/services/aerisApi';
import useAuthStore from '@/store/useAuthStore';
import { getStoredUser } from '@/services/auth';

const CONDITIONS = ['Asthma', 'COPD', 'Heart Disease', 'Diabetes', 'Allergies', 'Immunocompromised'];
const COND_ICONS = { Asthma: Wind, COPD: Activity, 'Heart Disease': Heart, Diabetes: Droplets, Allergies: Eye, Immunocompromised: Shield };
const SENSITIVITIES = [
  { id: 'low', label: 'Low', desc: 'Healthy adult, no major concerns', color: '#10b981', pct: 25 },
  { id: 'moderate', label: 'Moderate', desc: 'Occasional mild respiratory issues', color: '#f59e0b', pct: 50 },
  { id: 'high', label: 'High', desc: 'Chronic conditions or elderly', color: '#f97316', pct: 75 },
  { id: 'very_high', label: 'Very High', desc: 'Severe conditions, children, pregnant', color: '#ef4444', pct: 95 },
];

const slideVariants = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 100 : -100, scale: 0.93, filter: 'blur(6px)', rotateY: d > 0 ? 6 : -6 }),
  center: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)', rotateY: 0 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -100 : 100, scale: 0.93, filter: 'blur(6px)', rotateY: d > 0 ? -6 : 6 }),
};

export default function Onboarding() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ age: 28, sensitivity: 'moderate', conditions: [], outdoorExposureHours: 3 });

  const storedUser = getStoredUser();
  const firstName = storedUser?.name?.split(' ')[0] || 'there';

  const toggleCondition = (c) => setForm(f => ({ ...f, conditions: f.conditions.includes(c) ? f.conditions.filter(x => x !== c) : [...f.conditions, c] }));
  const goNext = () => { setDir(1); setStep(s => s + 1); };
  const goBack = () => { setDir(-1); setStep(s => s - 1); };

  const handleFinish = async () => {
    setSaving(true);
    try { await aerisApi.put('/profile', form); if (storedUser) setUser(storedUser); } catch {}
    finally { setSaving(false); navigate('/dashboard'); }
  };

  const TOTAL = 5;
  const isFirst = step === 0;
  const isLast = step === TOTAL - 1;

  // ── Animated SVG ring helper ──────────────────────────
  const Ring = ({ pct, color, size = 160, stroke = 6 }) => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(128,128,128,0.1)" strokeWidth={stroke} />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${(pct / 100) * c} ${c}` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    );
  };

  // ── Step content ──────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ─── Welcome ───────────────────────────────────────
      case 0: return (
        <div className="text-center">
          {/* Animated greeting */}
          <motion.div className="relative w-24 h-24 mx-auto mb-8"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}>
            <div className="w-24 h-24 rounded-3xl bg-linear-to-br from-(--color-primary) to-(--color-secondary) flex items-center justify-center shadow-xl shadow-(--color-primary)/30">
              <Sparkles size={36} className="text-white" />
            </div>
            {/* Orbiting dots */}
            {[0, 1, 2, 3].map(i => (
              <motion.div key={i} className="absolute w-2.5 h-2.5 rounded-full bg-(--color-accent)"
                style={{ top: '50%', left: '50%' }}
                animate={{ x: [0, Math.cos(i * Math.PI/2) * 52], y: [0, Math.sin(i * Math.PI/2) * 52], opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
              />
            ))}
          </motion.div>

          <motion.h1 className="text-3xl font-black text-(--color-text-primary) mb-2"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            Welcome, {firstName}!
          </motion.h1>
          <motion.p className="text-sm text-(--color-text-secondary) mb-10 max-w-sm mx-auto leading-relaxed"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
            Let's personalize AERIS in 30 seconds to calculate your personal air quality risk score.
          </motion.p>

          {/* Feature cards — staggered fly-in */}
          <div className="space-y-3 text-left max-w-sm mx-auto">
            {[
              { icon: Shield, text: 'Personal Risk Index', sub: 'Tailored to your health profile', color: '#06b6d4', delay: 0.5 },
              { icon: Heart, text: 'Smart Health Alerts', sub: 'Condition-specific warnings', color: '#f43f5e', delay: 0.65 },
              { icon: Wind, text: 'Air Quality Insights', sub: 'Real-time environmental guidance', color: '#10b981', delay: 0.8 },
            ].map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: f.delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-4 p-4 rounded-2xl subtle-surface border border-(--color-card-border) group hover:border-(--color-primary)/30 transition-colors"
              >
                <motion.div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${f.color}15` }}
                  whileHover={{ scale: 1.1, rotate: 5 }}>
                  <f.icon size={20} style={{ color: f.color }} />
                </motion.div>
                <div>
                  <span className="text-sm font-bold text-(--color-text-primary)">{f.text}</span>
                  <span className="block text-[11px] text-(--color-text-secondary) mt-0.5">{f.sub}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      );

      // ─── Age ───────────────────────────────────────────
      case 1: {
        const ageColor = form.age < 12 ? '#06b6d4' : form.age < 60 ? '#10b981' : '#f59e0b';
        const agePct = Math.min(form.age, 100);
        const ageLabel = form.age < 12 ? 'Child' : form.age < 18 ? 'Teen' : form.age < 60 ? 'Adult' : 'Senior';
        return (
          <div>
            <motion.h1 className="text-2xl font-black text-(--color-text-primary) mb-1" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
              How old are you?
            </motion.h1>
            <motion.p className="text-sm text-(--color-text-secondary) mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              Age affects how pollutants impact your body.
            </motion.p>

            <motion.div className="flex flex-col items-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
              {/* Circular gauge */}
              <div className="relative mb-6">
                <Ring pct={agePct} color={ageColor} size={180} stroke={8} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span key={form.age} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl font-black tabular-nums" style={{ color: ageColor }}>{form.age}</motion.span>
                  <motion.span key={ageLabel} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: ageColor }}>{ageLabel}</motion.span>
                </div>
              </div>

              <input type="range" min={1} max={100} value={form.age}
                onChange={e => setForm(f => ({ ...f, age: Number(e.target.value) }))}
                className="w-full max-w-xs accent-(--color-primary) h-2" />
              <div className="flex justify-between w-full max-w-xs text-[9px] font-bold text-(--color-text-secondary) opacity-40 uppercase tracking-widest mt-2">
                <span>1</span><span>18</span><span>40</span><span>60</span><span>100</span>
              </div>
            </motion.div>
          </div>
        );
      }

      // ─── Sensitivity ───────────────────────────────────
      case 2: {
        const sel = SENSITIVITIES.find(s => s.id === form.sensitivity) || SENSITIVITIES[1];
        return (
          <div>
            <motion.h1 className="text-2xl font-black text-(--color-text-primary) mb-1" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
              Air Sensitivity Level
            </motion.h1>
            <motion.p className="text-sm text-(--color-text-secondary) mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              Sets your base Risk Index multiplier.
            </motion.p>

            {/* Visual gauge */}
            <motion.div className="flex justify-center mb-6" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
              <div className="relative">
                <Ring pct={sel.pct} color={sel.color} size={120} stroke={6} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.span key={sel.id} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="text-lg font-black" style={{ color: sel.color }}>{sel.label}</motion.span>
                </div>
              </div>
            </motion.div>

            <div className="space-y-2.5">
              {SENSITIVITIES.map((s, i) => (
                <motion.button key={s.id}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                  onClick={() => setForm(f => ({ ...f, sensitivity: s.id }))}
                  className={`w-full flex items-center gap-4 p-3.5 rounded-2xl border transition-all ${
                    form.sensitivity === s.id ? 'border-transparent shadow-lg' : 'border-(--color-card-border) subtle-surface hover:bg-white/10'
                  }`}
                  style={form.sensitivity === s.id ? { backgroundColor: `${s.color}12`, borderColor: `${s.color}40`, boxShadow: `0 4px 24px ${s.color}15` } : {}}
                  whileTap={{ scale: 0.97 }}
                >
                  <motion.div className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center"
                    style={{ borderColor: s.color }}>
                    <AnimatePresence>
                      {form.sensitivity === s.id && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                          className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      )}
                    </AnimatePresence>
                  </motion.div>
                  <div className="text-left flex-1">
                    <span className="text-sm font-bold text-(--color-text-primary)">{s.label}</span>
                    <span className="block text-[11px] text-(--color-text-secondary)">{s.desc}</span>
                  </div>
                  <div className="w-12 h-1.5 rounded-full overflow-hidden subtle-surface shrink-0">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: s.color }}
                      animate={{ width: form.sensitivity === s.id ? '100%' : `${s.pct}%` }}
                      transition={{ duration: 0.4 }} />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        );
      }

      // ─── Conditions ────────────────────────────────────
      case 3: return (
        <div>
          <motion.h1 className="text-2xl font-black text-(--color-text-primary) mb-1" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            Health Conditions
          </motion.h1>
          <motion.p className="text-sm text-(--color-text-secondary) mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            Select all that apply — adjusts your risk multipliers.
          </motion.p>

          <div className="grid grid-cols-2 gap-3">
            {CONDITIONS.map((c, i) => {
              const sel = form.conditions.includes(c);
              const CIcon = COND_ICONS[c] || Heart;
              return (
                <motion.button key={c}
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}
                  onClick={() => toggleCondition(c)}
                  className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border text-center transition-all ${
                    sel ? 'bg-rose-500/10 border-rose-400/30' : 'subtle-surface border-(--color-card-border) hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${sel ? 'bg-rose-500/20' : 'bg-white/10'}`}
                    animate={sel ? { scale: [1, 1.15, 1], rotate: [0, 5, 0] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    <CIcon size={18} className={sel ? 'text-rose-400' : 'text-(--color-text-secondary)'} />
                  </motion.div>
                  <span className={`text-xs font-bold ${sel ? 'text-rose-400' : 'text-(--color-text-secondary)'}`}>{c}</span>
                  {sel && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center absolute -top-1 -right-1">
                    <span className="text-white text-[10px] font-bold">✓</span>
                  </motion.div>}
                </motion.button>
              );
            })}
          </div>
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            onClick={() => setForm(f => ({ ...f, conditions: [] }))}
            className="text-xs text-(--color-text-secondary) opacity-40 hover:opacity-70 transition-colors mt-4 block mx-auto">
            None of the above
          </motion.button>
        </div>
      );

      // ─── Outdoor Hours ─────────────────────────────────
      case 4: {
        const h = form.outdoorExposureHours;
        const hColor = h <= 2 ? '#10b981' : h <= 6 ? '#06b6d4' : h <= 9 ? '#f59e0b' : '#ef4444';
        const hLabel = h === 0 ? 'Fully Indoor' : h <= 2 ? 'Mostly Indoor' : h <= 6 ? 'Mixed' : h <= 9 ? 'Mostly Outdoor' : 'Heavy Outdoor';
        return (
          <div>
            <motion.h1 className="text-2xl font-black text-(--color-text-primary) mb-1" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
              Daily Outdoor Exposure
            </motion.h1>
            <motion.p className="text-sm text-(--color-text-secondary) mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              How many hours per day are you typically outdoors?
            </motion.p>

            <motion.div className="flex flex-col items-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
              {/* Clock-style gauge */}
              <div className="relative mb-6">
                <Ring pct={(h / 12) * 100} color={hColor} size={180} stroke={8} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span key={h} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl font-black tabular-nums" style={{ color: hColor }}>{h}</motion.span>
                  <span className="text-xs font-bold text-(--color-text-secondary)">hours/day</span>
                  <motion.span key={hLabel} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: hColor }}>{hLabel}</motion.span>
                </div>
              </div>

              <input type="range" min={0} max={12} step={1} value={h}
                onChange={e => setForm(f => ({ ...f, outdoorExposureHours: Number(e.target.value) }))}
                className="w-full max-w-xs accent-(--color-primary) h-2" />

              {/* Hour blocks visualization */}
              <div className="flex gap-1 mt-4">
                {Array.from({ length: 12 }, (_, i) => (
                  <motion.div key={i}
                    className="w-5 h-7 rounded-sm"
                    animate={{
                      backgroundColor: i < h ? hColor : 'rgba(128,128,128,0.12)',
                      scale: i < h ? 1 : 0.85,
                      opacity: i < h ? 1 : 0.4,
                    }}
                    transition={{ duration: 0.3, delay: i * 0.02 }}
                  />
                ))}
              </div>
              <div className="flex justify-between w-full max-w-xs text-[9px] font-bold text-(--color-text-secondary) uppercase tracking-widest mt-2">
                <span>0h Indoor</span><span>6h Mixed</span><span>12h Outdoor</span>
              </div>
            </motion.div>
          </div>
        );
      }
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden dashboard-bg" style={{ perspective: 1200 }}>

      {/* ── Animated Light Background ────────────────────── */}

      {/* Soft gradient mesh */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 15% 85%, rgba(31,81,163,0.08) 0%, transparent 60%), radial-gradient(ellipse 70% 70% at 85% 15%, rgba(6,182,212,0.07) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 50% 50%, rgba(34,167,240,0.04) 0%, transparent 50%)',
      }} />

      {/* Floating soft blobs */}
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ width: '45vw', height: '45vw', maxWidth: 500, maxHeight: 500, filter: 'blur(100px)', background: 'radial-gradient(circle, rgba(31,81,163,0.08) 0%, rgba(6,182,212,0.04) 50%, transparent 70%)' }}
        animate={{ x: ['-3%', '8%', '-3%'], y: ['0%', '-5%', '0%'], scale: [1, 1.1, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        initial={{ top: '8%', left: '12%' }} />
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ width: '35vw', height: '35vw', maxWidth: 400, maxHeight: 400, filter: 'blur(80px)', background: 'radial-gradient(circle, rgba(34,167,240,0.06) 0%, rgba(99,102,241,0.03) 50%, transparent 70%)' }}
        animate={{ x: ['3%', '-6%', '3%'], y: ['0%', '4%', '0%'], scale: [1, 1.08, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        initial={{ bottom: '12%', right: '8%' }} />

      {/* Subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035]" style={{
        backgroundImage: 'radial-gradient(circle, rgba(31,81,163,0.4) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Floating particles (soft blue) */}
      {Array.from({ length: 14 }, (_, i) => (
        <motion.div key={`p-${i}`} className="absolute rounded-full pointer-events-none"
          style={{ width: i % 3 === 0 ? 6 : 4, height: i % 3 === 0 ? 6 : 4, left: `${5 + (i * 47) % 90}%`, top: `${3 + (i * 31) % 90}%`, background: i % 2 === 0 ? 'rgba(31,81,163,0.15)' : 'rgba(6,182,212,0.12)' }}
          animate={{ y: [0, -25 - (i % 4) * 8, 0], opacity: [0.15, 0.5, 0.15], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: 5 + (i % 3), repeat: Infinity, delay: (i * 0.4) % 4, ease: 'easeInOut' }}
        />
      ))}

      {/* Soft horizon glow */}
      <motion.div className="absolute left-0 right-0 h-px pointer-events-none"
        style={{ top: '60%', background: 'linear-gradient(90deg, transparent 10%, rgba(31,81,163,0.08) 35%, rgba(6,182,212,0.1) 50%, rgba(31,81,163,0.08) 65%, transparent 90%)' }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Progress */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 glass-card backdrop-blur-md px-5 py-3 rounded-full shadow-xl border border-white/20">
        {Array.from({ length: TOTAL }, (_, i) => (
          <motion.div key={i} className="rounded-full"
            animate={{ width: i === step ? 28 : 8, height: 8, backgroundColor: i === step ? 'var(--color-primary)' : i < step ? 'var(--color-accent)' : 'rgba(128,128,128,0.2)' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
        ))}
        <span className="ml-3 text-[10px] font-bold text-(--color-text-secondary) tabular-nums">{step + 1}/{TOTAL}</span>
      </div>

      {/* Card */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={step} custom={dir} variants={slideVariants}
          initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg z-10" style={{ transformStyle: 'preserve-3d' }}>

          <div className="glass-card rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-(--color-primary) to-transparent opacity-30" />

            {renderStep()}

            {/* Navigation */}
            <motion.div className={`flex ${isFirst ? 'justify-end' : 'justify-between'} items-center pt-6 mt-8 border-t border-(--color-card-border)`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              {!isFirst && (
                <motion.button onClick={goBack}
                  className="px-4 py-2 text-sm font-bold text-(--color-text-secondary) hover:text-(--color-primary) transition-colors flex items-center gap-1.5"
                  whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }}>← Back</motion.button>
              )}
              {isLast ? (
                <motion.button onClick={handleFinish} disabled={saving}
                  className="flex items-center gap-2.5 px-8 py-3.5 bg-linear-to-r from-(--color-primary) to-(--color-secondary) rounded-xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 shadow-lg shadow-(--color-primary)/20 disabled:opacity-50"
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <span>{saving ? 'Saving...' : 'Start Exploring'}</span><ArrowRight size={16} />
                </motion.button>
              ) : (
                <motion.button onClick={goNext}
                  className="flex items-center gap-2 px-7 py-3.5 bg-(--color-primary)/10 hover:bg-(--color-primary)/20 border border-(--color-primary)/20 rounded-xl text-(--color-primary) font-black text-xs uppercase tracking-widest"
                  whileHover={{ scale: 1.03, x: 3 }} whileTap={{ scale: 0.97 }}>
                  <span>{isFirst ? 'Get Started' : 'Continue'}</span><ChevronRight size={16} />
                </motion.button>
              )}
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
