import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight, Heart, Wind, ChevronRight, Sparkles, Activity, Droplets, Eye, Check } from 'lucide-react';
import aerisApi from '@/services/aerisApi';
import useAuthStore from '@/store/useAuthStore';
import { getStoredUser } from '@/services/auth';

const CONDITIONS = ['Asthma', 'COPD', 'Heart Disease', 'Diabetes', 'Allergies', 'Immunocompromised'];
const COND_ICONS = { Asthma: Wind, COPD: Activity, 'Heart Disease': Heart, Diabetes: Droplets, Allergies: Eye, Immunocompromised: Shield };
const SENSITIVITIES = [
  { id: 'low', label: 'Low', desc: 'Healthy adult, no major concerns', color: '#10b981' },
  { id: 'moderate', label: 'Moderate', desc: 'Occasional mild respiratory issues', color: '#f59e0b' },
  { id: 'high', label: 'High', desc: 'Chronic conditions or elderly', color: '#f97316' },
  { id: 'very_high', label: 'Very High', desc: 'Severe conditions, children, pregnant', color: '#ef4444' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const currentYear = new Date().getFullYear();

const slideVariants = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 80 : -80, scale: 0.97 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -80 : 80, scale: 0.97 }),
};

export default function Onboarding() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ age: 28, sensitivity: 'moderate', conditions: [], outdoorExposureHours: 3 });
  const [dob, setDob] = useState({ day: '', month: '', year: '' });

  useEffect(() => {
    document.body.classList.add('dashboard-bg');
    return () => document.body.classList.remove('dashboard-bg');
  }, []);

  const storedUser = getStoredUser();
  const firstName = storedUser?.name?.split(' ')[0] || 'there';

  // Auto-calculate age from DOB
  const calculatedAge = useMemo(() => {
    if (!dob.day || !dob.month || !dob.year) return null;
    const birth = new Date(Number(dob.year), Number(dob.month), Number(dob.day));
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return Math.max(0, Math.min(age, 120));
  }, [dob]);

  useEffect(() => {
    if (calculatedAge !== null) setForm(f => ({ ...f, age: calculatedAge }));
  }, [calculatedAge]);

  const daysInMonth = useMemo(() => {
    if (!dob.month || !dob.year) return 31;
    return new Date(Number(dob.year), Number(dob.month) + 1, 0).getDate();
  }, [dob.month, dob.year]);

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

  // ── Animated SVG ring helper (only used for outdoor section) ──
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

  const selectClass = 'w-full appearance-none bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 cursor-pointer';

  // ── Step content ──────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ─── Welcome (minimal) ─────────────────────────────
      case 0: return (
        <div className="text-center py-4">
          <motion.div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-linear-to-br from-(--color-primary) to-(--color-secondary) flex items-center justify-center shadow-lg shadow-(--color-primary)/20"
            initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}>
            <Sparkles size={28} className="text-white" />
          </motion.div>

          <motion.h1 className="text-3xl font-black text-(--color-text-primary) mb-3"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            Welcome, {firstName}!
          </motion.h1>

          <motion.p className="text-base text-(--color-text-secondary) mb-3 max-w-xs mx-auto leading-relaxed"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            Let's set up your health profile to personalize your air quality experience.
          </motion.p>

          <motion.p className="text-xs text-(--color-text-secondary)/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            This takes about 30 seconds
          </motion.p>
        </div>
      );

      // ─── Date of Birth ─────────────────────────────────
      case 1: {
        const ageLabel = calculatedAge !== null
          ? (calculatedAge < 12 ? 'Child' : calculatedAge < 18 ? 'Teen' : calculatedAge < 60 ? 'Adult' : 'Senior')
          : null;
        return (
          <div>
            <motion.h1 className="text-2xl font-black text-(--color-text-primary) mb-1" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
              Date of Birth
            </motion.h1>
            <motion.p className="text-sm text-(--color-text-secondary) mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              Age affects how pollutants impact your body.
            </motion.p>

            <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              {/* Day / Month / Year dropdowns */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest mb-1.5">Day</label>
                  <select value={dob.day} onChange={e => setDob(d => ({ ...d, day: e.target.value }))} className={selectClass}>
                    <option value="">--</option>
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest mb-1.5">Month</label>
                  <select value={dob.month} onChange={e => setDob(d => ({ ...d, month: e.target.value }))} className={selectClass}>
                    <option value="">--</option>
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i}>{m.slice(0, 3)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest mb-1.5">Year</label>
                  <select value={dob.year} onChange={e => setDob(d => ({ ...d, year: e.target.value }))} className={selectClass}>
                    <option value="">--</option>
                    {Array.from({ length: 100 }, (_, i) => currentYear - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Calculated age display */}
              <AnimatePresence>
                {calculatedAge !== null && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-between p-4 rounded-2xl border border-(--color-primary)/15 bg-(--color-primary)/5">
                    <div>
                      <span className="text-xs font-bold text-(--color-text-secondary) uppercase tracking-wider">Your age</span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <motion.span key={calculatedAge} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                          className="text-3xl font-black text-(--color-primary) tabular-nums">{calculatedAge}</motion.span>
                        <span className="text-sm font-semibold text-(--color-text-secondary)">years</span>
                      </div>
                    </div>
                    {ageLabel && (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-(--color-primary)/10 text-(--color-primary)">
                        {ageLabel}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        );
      }

      // ─── Sensitivity (segmented selector) ──────────────
      case 2: {
        const sel = SENSITIVITIES.find(s => s.id === form.sensitivity) || SENSITIVITIES[1];
        return (
          <div>
            <motion.h1 className="text-2xl font-black text-(--color-text-primary) mb-1" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
              Air Sensitivity
            </motion.h1>
            <motion.p className="text-sm text-(--color-text-secondary) mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              How sensitive are you to air quality changes?
            </motion.p>

            {/* Segmented control */}
            <motion.div className="relative flex rounded-xl border border-slate-200 bg-slate-50/80 p-1 mb-6"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              {SENSITIVITIES.map((s) => {
                const active = form.sensitivity === s.id;
                return (
                  <button key={s.id} onClick={() => setForm(f => ({ ...f, sensitivity: s.id }))}
                    className="relative flex-1 py-2.5 text-xs font-bold rounded-lg transition-colors z-10"
                    style={{ color: active ? '#fff' : '#64748b' }}>
                    {active && (
                      <motion.div layoutId="sens-bg" className="absolute inset-0 rounded-lg shadow-sm"
                        style={{ backgroundColor: s.color }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    )}
                    <span className="relative z-10">{s.label}</span>
                  </button>
                );
              })}
            </motion.div>

            {/* Description card */}
            <AnimatePresence mode="wait">
              <motion.div key={sel.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="p-5 rounded-2xl border transition-all"
                style={{ borderColor: `${sel.color}25`, backgroundColor: `${sel.color}08` }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sel.color }} />
                  <span className="text-sm font-bold text-(--color-text-primary)">{sel.label} Sensitivity</span>
                </div>
                <p className="text-sm text-(--color-text-secondary) leading-relaxed">{sel.desc}</p>

                {/* Simple visual bar */}
                <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div className="h-full rounded-full"
                    style={{ backgroundColor: sel.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${SENSITIVITIES.indexOf(sel) / (SENSITIVITIES.length - 1) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[9px] font-bold text-(--color-text-secondary)/40 uppercase tracking-widest">
                  <span>Minimal</span><span>Maximum</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        );
      }

      // ─── Health Conditions (list with checkboxes) ──────
      case 3: return (
        <div>
          <motion.h1 className="text-2xl font-black text-(--color-text-primary) mb-1" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            Health Conditions
          </motion.h1>
          <motion.p className="text-sm text-(--color-text-secondary) mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            Select any that apply to you.
          </motion.p>

          <div className="space-y-2">
            {CONDITIONS.map((c, i) => {
              const sel = form.conditions.includes(c);
              const CIcon = COND_ICONS[c] || Heart;
              return (
                <motion.button key={c}
                  initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + i * 0.05 }}
                  onClick={() => toggleCondition(c)}
                  className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border transition-all ${
                    sel
                      ? 'border-(--color-primary)/30 bg-(--color-primary)/5'
                      : 'border-slate-200/80 bg-white/40 hover:bg-white/70'
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${
                    sel ? 'bg-(--color-primary) border-(--color-primary)' : 'border-slate-300'
                  }`}>
                    <AnimatePresence>
                      {sel && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    sel ? 'bg-(--color-primary)/10' : 'bg-slate-100'
                  }`}>
                    <CIcon size={15} className={sel ? 'text-(--color-primary)' : 'text-slate-400'} />
                  </div>

                  {/* Label */}
                  <span className={`text-sm font-semibold transition-colors ${
                    sel ? 'text-(--color-primary)' : 'text-(--color-text-primary)'
                  }`}>{c}</span>
                </motion.button>
              );
            })}
          </div>

          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            onClick={() => setForm(f => ({ ...f, conditions: [] }))}
            className="text-xs text-(--color-text-secondary)/50 hover:text-(--color-text-secondary) transition-colors mt-4 block mx-auto">
            None of the above
          </motion.button>
        </div>
      );

      // ─── Outdoor Hours (unchanged) ─────────────────────
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ perspective: 1200 }}>

      {/* ── Subtle Background Accents ─────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 15% 85%, rgba(31,81,163,0.06) 0%, transparent 60%), radial-gradient(ellipse 70% 70% at 85% 15%, rgba(6,182,212,0.05) 0%, transparent 60%)',
      }} />

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
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg z-10">

          <div className="glass-card rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-(--color-primary) to-transparent opacity-30" />

            {renderStep()}

            {/* Navigation */}
            <motion.div className={`flex ${isFirst ? 'justify-end' : 'justify-between'} items-center pt-6 mt-8 border-t border-(--color-card-border)`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
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
