import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { login } from '@/services/auth';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060910] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.04),transparent_50%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-3xl p-10 shadow-2xl shadow-black/20">
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-14 h-14 bg-linear-to-br from-sky-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">AERIS</h1>
            <p className="text-xs text-slate-500 mt-2 text-center">Enter your credentials to access live environmental telemetry</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/[0.06] rounded-xl p-3 mb-6 text-sm text-red-400 text-center">{error}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Secure Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@aeris.io"
                required
                className="w-full px-4 py-3.5 bg-white/[0.04] rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Passphrase</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3.5 bg-white/[0.04] rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/40 transition-colors pr-12"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-linear-to-r from-sky-500 to-blue-600 rounded-xl text-sm font-bold uppercase tracking-widest text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'AUTHENTICATING...' : 'INITIALIZE UPLINK'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-8">
            No active clearance? <Link to="/signup" className="text-sky-400 font-bold hover:underline">Request Access</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
