import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Shield, Save, Edit3, Clock, Wind, Lock,
  AlertTriangle, CheckCircle, HeartPulse, Mail, Calendar,
  Activity, Cigarette, Sun, Moon, Stethoscope, Gauge, UserCircle, Monitor
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';
import useAuthStore from '@/store/useAuthStore';
import aerisApi from '@/services/aerisApi';

const calcModifier = (form, baseAqi) => {
  let mod = 1.0;
  if (form.age < 12) mod += 0.25;
  else if (form.age > 65) mod += 0.3;
  if (form.conditions?.includes('Asthma')) mod += 0.4;
  if (form.conditions?.includes('Heart Disease')) mod += 0.35;
  if (form.conditions?.includes('COPD')) mod += 0.5;
  if (form.smoking === 'heavy') mod += 0.3;
  else if (form.smoking === 'light') mod += 0.15;
  if (form.activityLevel === 'very_active') mod += 0.25;
  else if (form.activityLevel === 'active') mod += 0.15;
  if (form.commuteMode === 'biking' || form.commuteMode === 'walking') mod += 0.2;
  else if (form.commuteMode === 'transit') mod += 0.1;
  if (form.environment === 'urban') mod += 0.15;

  const rri = Math.min(100, Math.round(baseAqi * mod));
  const color = mod >= 1.5 ? '#ef4444' : mod >= 1.2 ? '#f59e0b' : '#22c55e';
  return { modifier: Number(mod.toFixed(2)), rri, color };
};

const SENSITIVITY = { low: 'Low', moderate: 'Moderate', high: 'High', very_high: 'Very High' };
const CONDITIONS = ['Asthma', 'COPD', 'Heart Disease', 'Diabetes', 'Allergies', 'Immunocompromised'];

const Profile = () => {
  const data = useAerisStore((s) => s.data);
  const user = useAuthStore((s) => s.user);

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', age: 28, gender: 'prefer_not_to_say',
    smoking: 'none', conditions: [], sensitivity: 'moderate',
    outdoorExposureHours: 3, activityLevel: 'moderate',
    commuteMode: 'mixed', environment: 'suburban',
  });

  const [theme, setTheme] = useState(() => localStorage.getItem('aeris-theme') || 'light');

  const applyTheme = (t) => {
    setTheme(t);
    localStorage.setItem('aeris-theme', t);
    if (t === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  const [accountForm, setAccountForm] = useState({ name: '', email: '', currentPassword: '', newPassword: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountError, setAccountError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await aerisApi.get('/profile');
        if (res.data?.success) {
          const p = res.data.data;
          setForm((prev) => ({
            ...prev,
            name: p.name || user?.name || '',
            email: p.email || user?.email || '',
            phone: p.phone || '',
            age: p.age || 28,
            conditions: Array.isArray(p.conditions) ? p.conditions : [],
            sensitivity: p.sensitivity || 'moderate',
            outdoorExposureHours: p.outdoorExposureHours || 3,
            activityLevel: p.activityLevel || 'moderate',
            commuteMode: p.commuteMode || 'mixed',
            environment: p.environment || 'suburban',
          }));
        }
      } catch {
        if (user) setForm((prev) => ({ ...prev, name: user.name || '', email: user.email || '' }));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (user) setAccountForm((prev) => ({ ...prev, name: user.name || '', email: user.email || '' }));
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await aerisApi.put('/profile', {
        name: form.name, age: form.age, phone: form.phone, sensitivity: form.sensitivity, 
        conditions: form.conditions, outdoorExposureHours: form.outdoorExposureHours, 
        smoking: form.smoking, activityLevel: form.activityLevel, 
        commuteMode: form.commuteMode, environment: form.environment,
      });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleAccountSave = async (e) => {
    e.preventDefault();
    setAccountError('');
    if (!accountForm.currentPassword) { setAccountError('Current password is required.'); return; }
    setSavingAccount(true);
    try {
      const payload = { name: accountForm.name, email: accountForm.email, currentPassword: accountForm.currentPassword };
      if (accountForm.newPassword) payload.newPassword = accountForm.newPassword;
      const res = await aerisApi.put('/auth/update', payload);
      if (res.data?.success) {
        setAccountSaved(true);
        setAccountForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
        useAuthStore.getState().setUser(res.data.data);
        setTimeout(() => setAccountSaved(false), 3000);
      } else {
        setAccountError(res.data?.error || 'Update failed');
      }
    } catch (err) {
      setAccountError(err.response?.data?.error || 'Failed to update');
    } finally {
      setSavingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const baseAqi = data?.derived?.aqi || 50;
  const live = calcModifier(form, baseAqi);

  const userInitials = form.name
    ? form.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="p-6 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-8">

      {/* ── Top Section: About Me Card ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-6 sm:p-8 glass-card border-(--color-card-border) rounded-3xl"
      >
        {/* Title + Edit button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight bg-linear-to-r from-(--color-primary) to-(--color-secondary) bg-clip-text text-transparent">
            Profile
          </h1>
          <div className="flex items-center gap-3">
            {saved && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-400">Saved</span>
              </div>
            )}
            <button
              onClick={() => (editing ? handleSave() : setEditing(true))}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg glass-button ${
                editing 
                  ? 'bg-emerald-500/10! border-emerald-500/30! text-emerald-400! hover:bg-emerald-500/20!'
                  : ''
              }`}
            >
              {editing ? <><Save size={16} />{saving ? 'Saving...' : 'Save'}</> : <><Edit3 size={16} />Edit</>}
            </button>
          </div>
        </div>

        {/* Profile header: info + avatar */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: Contact */}
          <div className="flex-1">
            {/* Contact grid */}
            <div>
              <h3 className="text-sm font-bold text-(--color-text-secondary) uppercase tracking-widest mb-4">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Name */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center subtle-surface group-hover:bg-(--color-primary)/10 transition-colors">
                    <UserCircle size={20} className="text-(--color-text-secondary) group-hover:text-(--color-primary)" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wide">Full Name</span>
                    {editing ? (
                      <input type="text" value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="bg-(--color-bg-main)/30 border border-(--color-card-border) rounded-lg px-2 py-1 text-(--color-text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
                      />
                    ) : (
                      <span className="text-sm font-bold text-(--color-text-primary)">{form.name || 'Not set'}</span>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center subtle-surface group-hover:bg-(--color-primary)/10 transition-colors">
                    <Mail size={20} className="text-(--color-text-secondary) group-hover:text-(--color-primary)" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wide">Secure Email</span>
                    {editing ? (
                      <input type="email" value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="bg-(--color-bg-main)/30 border border-(--color-card-border) rounded-lg px-2 py-1 text-(--color-text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
                      />
                    ) : (
                      <span className="text-sm font-bold text-(--color-text-primary) truncate max-w-[180px]">{form.email || 'Not set'}</span>
                    )}
                  </div>
                </div>

                {/* Contact Number */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center subtle-surface group-hover:bg-(--color-primary)/10 transition-colors">
                    <Mail size={20} className="text-(--color-text-secondary) group-hover:text-(--color-primary)" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wide">Contact Number</span>
                    {editing ? (
                      <input type="text" value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="bg-(--color-bg-main)/30 border border-(--color-card-border) rounded-lg px-2 py-1 text-(--color-text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
                      />
                    ) : (
                      <span className="text-sm font-bold text-(--color-text-primary)">
                        {form.phone ? form.phone.replace(/(\d{3})\d+(?=\d{3})/, '$1 **** ') : 'Not set'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Gender */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center subtle-surface group-hover:bg-(--color-primary)/10 transition-colors">
                    <User size={20} className="text-(--color-text-secondary) group-hover:text-(--color-primary)" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wide">Gender</span>
                    {editing ? (
                      <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="bg-(--color-bg-main)/30 border border-(--color-card-border) rounded-lg px-1 py-1 text-(--color-text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    ) : (
                      <span className="text-sm font-bold text-(--color-text-primary) capitalize">{(form.gender || '').replace(/_/g, ' ')}</span>
                    )}
                  </div>
                </div>

                {/* Age */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center subtle-surface group-hover:bg-(--color-primary)/10 transition-colors">
                    <Calendar size={20} className="text-(--color-text-secondary) group-hover:text-(--color-primary)" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wide">Age</span>
                    {editing ? (
                      <input type="number" value={form.age}
                        onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                        className="w-20 bg-(--color-bg-main)/30 border border-(--color-card-border) rounded-lg px-2 py-1 text-(--color-text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
                      />
                    ) : (
                      <span className="text-sm font-bold text-(--color-text-primary)">{form.age} yrs</span>
                    )}
                  </div>
                </div>

                {/* Environment */}
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center subtle-surface group-hover:bg-(--color-primary)/10 transition-colors">
                    <Shield size={20} className="text-(--color-text-secondary) group-hover:text-(--color-primary)" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wide">Environment</span>
                    {editing ? (
                      <select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}
                        className="bg-(--color-bg-main)/30 border border-(--color-card-border) rounded-lg px-1 py-1 text-(--color-text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
                      >
                        <option value="urban">Urban</option>
                        <option value="suburban">Suburban</option>
                        <option value="rural">Rural</option>
                      </select>
                    ) : (
                      <span className="text-sm font-bold text-(--color-text-primary) capitalize">{form.environment}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>
      </motion.div>

      {/* ── Bottom Section: Health Details + Risk Score ──────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="p-6 sm:p-8 glass-card border-(--color-card-border) rounded-3xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left column */}
          <div className="space-y-8">

            {/* Health Profile */}
            <div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                fontStyle: 'italic',
                color: 'var(--color-text-primary)',
                marginBottom: '1rem',
              }}>
                Health Profile
              </h3>

              {/* Air Sensitivity */}
              <div className="mb-6">
                <label className="text-sm text-(--color-text-secondary) mb-3 block font-bold uppercase tracking-wide">Air Sensitivity</label>
                {editing ? (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'low', color: '#22c55e' }, { id: 'moderate', color: '#eab308' },
                      { id: 'high', color: '#f97316' }, { id: 'very_high', color: '#ef4444' },
                    ].map((s) => (
                      <button key={s.id} onClick={() => setForm({ ...form, sensitivity: s.id })}
                        className="py-2 rounded-xl text-xs font-medium transition-all border"
                        style={form.sensitivity === s.id
                          ? { borderColor: `${s.color}60`, color: s.color, background: `${s.color}15` }
                          : { borderColor: 'rgba(0, 0, 0, 0.1)', color: 'var(--color-text-secondary)', background: 'rgba(0, 0, 0, 0.03)' }
                        }
                      >
                        {SENSITIVITY[s.id]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500/10">
                      <Gauge size={16} className="text-violet-600" />
                    </div>
                    <span className="text-base font-bold text-(--color-text-primary)">{SENSITIVITY[form.sensitivity]}</span>
                  </div>
                )}
              </div>

              {/* Smoking */}
              <div className="mb-6">
                <label className="text-sm text-(--color-text-secondary) mb-3 block font-bold uppercase tracking-wide">Smoking Status</label>
                {editing ? (
                  <div className="grid grid-cols-3 gap-2">
                    {['none', 'light', 'heavy'].map((l) => (
                      <button key={l} onClick={() => setForm({ ...form, smoking: l })}
                        className="py-2 rounded-xl text-xs font-medium capitalize transition-all border"
                        style={form.smoking === l
                          ? { background: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)', color: '#8b5cf6' }
                          : { borderColor: 'rgba(0, 0, 0, 0.1)', color: 'var(--color-text-secondary)', background: 'rgba(0, 0, 0, 0.03)' }
                        }
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500/10">
                      <Cigarette size={16} className="text-violet-600" />
                    </div>
                    <span className="text-base font-bold text-(--color-text-primary) capitalize">{form.smoking === 'none' ? 'Non-smoker' : form.smoking}</span>
                  </div>
                )}
              </div>

              {/* Outdoor Exposure */}
              <div>
                <label className="text-base text-(--color-text-secondary) mb-3 block font-bold uppercase tracking-wide">Daily Outdoor Exposure</label>
                {editing ? (
                  <div className="p-3 rounded-xl border" style={{ background: 'rgba(0, 0, 0, 0.03)', borderColor: 'rgba(0, 0, 0, 0.1)' }}>
                    <div className="flex justify-between mb-2">
                      <span className="text-lg font-bold text-violet-400">{form.outdoorExposureHours}h</span>
                      <span className="text-sm text-(--color-text-secondary)">per day</span>
                    </div>
                    <input type="range" min={0} max={12} step={1} value={form.outdoorExposureHours}
                      onChange={(e) => setForm({ ...form, outdoorExposureHours: Number(e.target.value) })}
                      className="w-full accent-violet-400"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500/10">
                      <Sun size={16} className="text-violet-600" />
                    </div>
                    <span className="text-base font-bold text-(--color-text-primary)">{form.outdoorExposureHours} hours per day</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pre-existing Conditions */}
            <div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                fontStyle: 'italic',
                color: 'var(--color-text-primary)',
                marginBottom: '1rem',
              }}>
                Conditions
              </h3>
              {editing ? (
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => {
                    const sel = form.conditions?.includes(c);
                    return (
                      <button key={c}
                        onClick={() => setForm({ ...form, conditions: sel ? form.conditions.filter((x) => x !== c) : [...(form.conditions || []), c] })}
                        className="px-4 py-2 rounded-xl text-xs font-medium transition-all border"
                        style={sel
                          ? { background: 'rgba(244, 63, 94, 0.12)', borderColor: 'rgba(244, 63, 94, 0.3)', color: '#e11d48' }
                          : { borderColor: 'rgba(0, 0, 0, 0.1)', color: 'var(--color-text-secondary)', background: 'rgba(0, 0, 0, 0.03)' }
                        }
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {form.conditions?.length > 0 ? form.conditions.map((c) => (
                    <span key={c} className="px-3 py-1.5 text-xs font-medium rounded-xl"
                      style={{ background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.25)', color: '#fb7185' }}
                    >{c}</span>
                  )) : (
                    <div className="flex items-center gap-2">
                      <Stethoscope size={14} className="text-violet-500" />
                      <span className="text-sm font-medium text-(--color-text-secondary)">None reported</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-8">

            {/* Risk Score */}
            <div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                fontStyle: 'italic',
                color: 'var(--color-text-primary)',
                marginBottom: '1rem',
              }}>
                Risk Score
              </h3>

              {/* Big RRI Display */}
              <div className="text-center py-8 rounded-2xl mb-4" style={{
                background: 'rgba(0, 0, 0, 0.03)',
                border: `1px solid ${live.color}50`,
              }}>
                <p className="text-xs text-(--color-text-secondary) opacity-60 mb-3 uppercase tracking-wider">Your Simulated RRI</p>
                <span className="text-6xl font-black tabular-nums" style={{ color: live.color }}>{live.rri}</span>
                {editing && live.rri !== data?.derived?.rri && (
                  <p className="text-xs text-(--color-text-primary) mt-3">Unsaved preview</p>
                )}
              </div>

              {/* Calculation breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.1)' }}>
                  <div>
                    <p className="text-[10px] text-(--color-text-secondary) font-bold uppercase tracking-wider">Base AQI</p>
                    <p className="text-xs text-(--color-text-secondary)">Current Reading</p>
                  </div>
                  <span className="text-xl font-bold text-(--color-text-primary)">{baseAqi}</span>
                </div>

                <div className="flex justify-center text-(--color-text-secondary) text-sm">×</div>

                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(0, 0, 0, 0.03)', border: `1px solid ${live.color}50` }}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: live.color }}>Vulnerability</p>
                    <p className="text-xs text-(--color-text-secondary)">Personal Modifier</p>
                  </div>
                  <span className="text-xl font-bold" style={{ color: live.color }}>{live.modifier}x</span>
                </div>

                {/* Modifier breakdown */}
                <div className="pl-4 border-l-2 space-y-1.5 text-xs text-(--color-text-secondary)" style={{ borderColor: 'rgba(139, 92, 246, 0.3)' }}>
                  <div className="flex justify-between"><span>Base</span><span>1.00x</span></div>
                  {(form.age < 12 || form.age > 65) && (
                    <div className="flex justify-between text-amber-500"><span>Age ({form.age})</span><span>+{form.age < 12 ? '0.25' : '0.30'}x</span></div>
                  )}
                  {form.smoking !== 'none' && (
                    <div className="flex justify-between text-orange-400"><span>Smoking</span><span>+{form.smoking === 'heavy' ? '0.30' : '0.15'}x</span></div>
                  )}
                  {form.conditions?.length > 0 && (
                    <div className="flex justify-between text-rose-400"><span>Conditions</span><span>applied</span></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Account Settings Card ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="p-6 sm:p-8 glass-card border-(--color-card-border) rounded-3xl"
      >
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 800,
          fontStyle: 'italic',
          color: 'var(--color-text-primary)',
          marginBottom: '1.5rem',
        }}>
          Account Settings
        </h3>
        <form onSubmit={handleAccountSave} className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <label className="text-sm text-(--color-text-secondary) mb-2 block font-bold uppercase tracking-wide">Name</label>
              <input type="text" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                className="w-full rounded-xl px-4 py-3 text-(--color-text-primary) text-sm font-medium focus:outline-none transition-colors border border-(--color-card-border) bg-(--color-bg-main)/30 focus:ring-2 focus:ring-(--color-primary)/20"
              />
            </div>
            <div>
              <label className="text-sm text-(--color-text-secondary) mb-2 block font-bold uppercase tracking-wide">Email</label>
              <input type="email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                className="w-full rounded-xl px-4 py-3 text-(--color-text-primary) text-sm font-medium focus:outline-none transition-colors border border-(--color-card-border) bg-(--color-bg-main)/30 focus:ring-2 focus:ring-(--color-primary)/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <label className="text-sm text-(--color-text-secondary) mb-2 block font-bold uppercase tracking-wide">Current Password *</label>
              <input type="password" placeholder="Required" value={accountForm.currentPassword}
                onChange={(e) => setAccountForm({ ...accountForm, currentPassword: e.target.value })}
                className="w-full rounded-xl px-4 py-3 text-(--color-text-primary) text-sm font-medium focus:outline-none transition-colors border border-(--color-card-border) bg-(--color-bg-main)/30 focus:ring-2 focus:ring-(--color-primary)/20"
              />
            </div>
            <div>
              <label className="text-sm text-(--color-text-secondary) mb-2 block font-bold uppercase tracking-wide">New Password</label>
              <input type="password" placeholder="Optional" value={accountForm.newPassword}
                onChange={(e) => setAccountForm({ ...accountForm, newPassword: e.target.value })}
                className="w-full rounded-xl px-4 py-3 text-(--color-text-primary) text-sm font-medium focus:outline-none transition-colors border border-(--color-card-border) bg-(--color-bg-main)/30 focus:ring-2 focus:ring-(--color-primary)/20"
              />
            </div>
          </div>
          {accountError && (
            <div className="text-xs text-rose-600 p-3 rounded-xl flex items-center gap-2" /* Changed for light theme */
              style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)' }}
            >
              <AlertTriangle size={14} />{accountError}
            </div>
          )}
          {accountSaved && (
            <div className="text-xs text-emerald-600 p-3 rounded-xl flex items-center gap-2" /* Changed for light theme */
              style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
            >
              <CheckCircle size={14} />Updated successfully
            </div>
          )}
          <button type="submit" disabled={savingAccount || !accountForm.currentPassword}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 bg-violet-500 text-white hover:bg-violet-600" /* Changed for light theme */
          >
            <Lock size={16} />{savingAccount ? 'Updating...' : 'Update Account'}
          </button>
        </form>
      </motion.div>

      {/* ── Appearance / Theme Card ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="p-6 sm:p-8 glass-card border-(--color-card-border) rounded-3xl"
      >
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 800,
          fontStyle: 'italic',
          color: 'var(--color-text-primary)',
          marginBottom: '1.5rem',
        }}>
          Appearance
        </h3>
        <p className="text-sm text-(--color-text-secondary) mb-6">Choose your preferred theme for the AERIS dashboard.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'light', label: 'Light', icon: Sun, desc: 'Glass morphism with light background' },
            { id: 'dark', label: 'Dark', icon: Moon, desc: 'Deep navy with dark panels' },
            { id: 'system', label: 'System', icon: Monitor, desc: 'Follow your OS preference' },
          ].map((t) => {
            const isActive = theme === t.id || (theme === 'system' && t.id === 'system');
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    applyTheme(prefersDark ? 'dark' : 'light');
                    localStorage.setItem('aeris-theme', 'system');
                    setTheme('system');
                  } else {
                    applyTheme(t.id);
                  }
                }}
                className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                  isActive
                    ? 'border-(--color-primary) bg-(--color-primary)/10'
                    : 'border-(--color-card-border) hover:border-(--color-primary)/40'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-(--color-primary)/20' : 'bg-black/5'
                }`}>
                  <t.icon size={22} className={isActive ? 'text-(--color-primary)' : 'text-(--color-text-secondary)'} />
                </div>
                <span className={`text-sm font-semibold ${isActive ? 'text-(--color-primary)' : 'text-(--color-text-primary)'}`}>
                  {t.label}
                </span>
                <span className="text-[11px] text-(--color-text-secondary) text-center leading-snug">{t.desc}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
