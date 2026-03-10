import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, Eye, EyeOff, UserPlus } from 'lucide-react';
import { registerUser } from '@/services/auth';

const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError('Passphrases do not match');
      return;
    }

    setLoading(true);
    try {
      await registerUser(form.name, form.email, form.password);
      navigate('/onboarding');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md z-10"
      >
        <div className="glass-card p-10 shadow-2xl border border-white/40">
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <Link to="/">
              <img src="/logo.png" alt="AERIS Logo" className="h-24 w-auto object-contain mb-2 hover:scale-105 transition-transform" />
            </Link>
            <p className="text-xs text-slate-500 mt-2 text-center font-medium uppercase tracking-widest opacity-70">New Clearance Request</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-6 text-sm text-rose-600 text-center font-medium"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
                required
                className="w-full px-4 py-3.5 bg-white/40 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-(--color-primary) focus:ring-4 focus:ring-(--color-primary)/10 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Secure Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="operator@aeris.io"
                required
                className="w-full px-4 py-3.5 bg-white/40 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-(--color-primary) focus:ring-4 focus:ring-(--color-primary)/10 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Passphrase</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3.5 bg-white/40 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-(--color-primary) focus:ring-4 focus:ring-(--color-primary)/10 transition-all pr-12"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-(--color-primary) transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Confirm Passphrase</label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3.5 bg-white/40 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-(--color-primary) focus:ring-4 focus:ring-(--color-primary)/10 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-linear-to-r from-(--color-primary) to-(--color-secondary) rounded-xl text-xs font-black uppercase tracking-widest text-white hover:opacity-90 shadow-lg shadow-(--color-primary)/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-3"
            >
              <span>{loading ? 'Requesting...' : 'Create Account'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-200/50 text-center">
            <p className="text-sm text-slate-500">
              Already have clearance? <Link to="/login" className="text-(--color-primary) font-bold hover:underline">Initialize Uplink</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
