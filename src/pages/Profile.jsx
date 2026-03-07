import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Shield, Save, Edit3, Clock, Wind, Lock,
  AlertTriangle, CheckCircle, HeartPulse
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
    name: '', email: '', age: 28, gender: 'prefer_not_to_say',
    smoking: 'none', conditions: [], sensitivity: 'moderate',
    outdoorExposureHours: 3, activityLevel: 'moderate',
    commuteMode: 'mixed', environment: 'suburban',
  });

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
        age: form.age, sensitivity: form.sensitivity, conditions: form.conditions,
        outdoorExposureHours: form.outdoorExposureHours, smoking: form.smoking,
        activityLevel: form.activityLevel, commuteMode: form.commuteMode, environment: form.environment,
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

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Profile</h1>
          {form.name && (
            <div className="flex items-center gap-2.5 mt-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                {form.name[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{form.name}</p>
                <p className="text-[11px] text-slate-500">{form.email}</p>
              </div>
            </div>
          )}
        </div>
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
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              editing ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {editing ? <><Save size={16} />{saving ? 'Saving...' : 'Save'}</> : <><Edit3 size={16} />Edit</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* Left: Form */}
        <div className="xl:col-span-7 space-y-5">
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6 space-y-6">
            <h3 className="text-sm font-semibold text-slate-300">Health Profile</h3>

            {/* Age + Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Age</label>
                {editing ? (
                  <input type="number" min={1} max={120} value={form.age}
                    onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-sky-500 transition-colors"
                  />
                ) : (
                  <div className="text-sm text-white p-2.5 bg-slate-900/50 border border-slate-700/30 rounded-lg">{form.age} years</div>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Gender</label>
                {editing ? (
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-sky-500 appearance-none"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                ) : (
                  <div className="text-sm text-white p-2.5 bg-slate-900/50 border border-slate-700/30 rounded-lg capitalize">{(form.gender || '').replace(/_/g, ' ')}</div>
                )}
              </div>
            </div>

            {/* Sensitivity */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Air Sensitivity</label>
              {editing ? (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'low', color: '#22c55e' }, { id: 'moderate', color: '#eab308' },
                    { id: 'high', color: '#f97316' }, { id: 'very_high', color: '#ef4444' },
                  ].map((s) => (
                    <button key={s.id} onClick={() => setForm({ ...form, sensitivity: s.id })}
                      className={`py-2 rounded-lg text-xs font-medium transition-colors border ${
                        form.sensitivity === s.id ? 'border-slate-500 text-white' : 'border-slate-700/40 text-slate-500 bg-slate-900/50'
                      }`}
                      style={form.sensitivity === s.id ? { borderColor: `${s.color}60`, color: s.color, background: `${s.color}10` } : {}}
                    >
                      {SENSITIVITY[s.id]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white p-2.5 bg-slate-900/50 border border-slate-700/30 rounded-lg">{SENSITIVITY[form.sensitivity]}</div>
              )}
            </div>

            {/* Smoking */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Smoking</label>
              {editing ? (
                <div className="grid grid-cols-3 gap-2">
                  {['none', 'light', 'heavy'].map((l) => (
                    <button key={l} onClick={() => setForm({ ...form, smoking: l })}
                      className={`py-2 rounded-lg text-xs font-medium capitalize transition-colors border ${
                        form.smoking === l ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-slate-900/50 border-slate-700/40 text-slate-500'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white p-2.5 bg-slate-900/50 border border-slate-700/30 rounded-lg capitalize">
                  {form.smoking === 'none' ? 'Non-smoker' : form.smoking}
                </div>
              )}
            </div>

            {/* Outdoor hours */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Daily Outdoor Exposure</label>
              {editing ? (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-lg font-bold text-sky-400">{form.outdoorExposureHours}h</span>
                    <span className="text-xs text-slate-500">per day</span>
                  </div>
                  <input type="range" min={0} max={12} step={1} value={form.outdoorExposureHours}
                    onChange={(e) => setForm({ ...form, outdoorExposureHours: Number(e.target.value) })}
                    className="w-full accent-sky-400"
                  />
                </div>
              ) : (
                <div className="text-sm text-white p-2.5 bg-slate-900/50 border border-slate-700/30 rounded-lg">
                  {form.outdoorExposureHours}h per day
                </div>
              )}
            </div>

            {/* Conditions */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Pre-existing Conditions</label>
              {editing ? (
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => {
                    const sel = form.conditions?.includes(c);
                    return (
                      <button key={c}
                        onClick={() => setForm({ ...form, conditions: sel ? form.conditions.filter((x) => x !== c) : [...(form.conditions || []), c] })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                          sel ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-slate-900/50 border-slate-700/40 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {form.conditions?.length > 0 ? form.conditions.map((c) => (
                    <span key={c} className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-md text-xs">{c}</span>
                  )) : (
                    <span className="text-sm text-slate-500 p-2.5 bg-slate-900/50 border border-slate-700/30 rounded-lg w-full block">None reported</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Account */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-5">Account Settings</h3>
            <form onSubmit={handleAccountSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Name</label>
                  <input type="text" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Email</label>
                  <input type="email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Current Password *</label>
                  <input type="password" placeholder="Required" value={accountForm.currentPassword}
                    onChange={(e) => setAccountForm({ ...accountForm, currentPassword: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">New Password</label>
                  <input type="password" placeholder="Optional" value={accountForm.newPassword}
                    onChange={(e) => setAccountForm({ ...accountForm, newPassword: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              {accountError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={14} />{accountError}
                </div>
              )}
              {accountSaved && (
                <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg flex items-center gap-2">
                  <CheckCircle size={14} />Updated successfully
                </div>
              )}
              <button type="submit" disabled={savingAccount || !accountForm.currentPassword}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <Lock size={16} />{savingAccount ? 'Updating...' : 'Update Account'}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Live RRI Calculation */}
        <div className="xl:col-span-5">
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-5">Live Risk Calculation</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
                <div>
                  <p className="text-[11px] text-slate-500">Step 1</p>
                  <p className="text-xs text-slate-300">Base AQI</p>
                </div>
                <span className="text-xl font-bold text-white">{baseAqi}</span>
              </div>

              <div className="flex justify-center text-slate-600 text-lg">&times;</div>

              <div className="flex items-center justify-between p-3 bg-slate-900/50 border rounded-lg" style={{ borderColor: `${live.color}30` }}>
                <div>
                  <p className="text-[11px]" style={{ color: live.color }}>Step 2</p>
                  <p className="text-xs text-slate-300">Vulnerability Modifier</p>
                </div>
                <span className="text-xl font-bold" style={{ color: live.color }}>{live.modifier}x</span>
              </div>

              {/* Breakdown */}
              <div className="pl-4 border-l-2 border-slate-700/50 space-y-1.5 text-xs text-slate-500">
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

              <div className="h-px bg-slate-700/40" />

              {/* Result */}
              <div className="text-center py-6 bg-slate-900/50 rounded-xl border" style={{ borderColor: `${live.color}30` }}>
                <p className="text-xs text-slate-500 mb-2">Your Simulated RRI</p>
                <span className="text-5xl font-bold tabular-nums" style={{ color: live.color }}>{live.rri}</span>
                {editing && live.rri !== data?.derived?.rri && (
                  <p className="text-xs text-sky-400 mt-3">Unsaved preview</p>
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
