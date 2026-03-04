import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, Eye, EyeOff } from 'lucide-react';

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
    
    // Demo auth — accepts any credentials
    setTimeout(() => {
      localStorage.setItem('aeris_token', 'demo_token');
      navigate('/dashboard');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] flex items-center justify-center p-4">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.05),transparent_50%)]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">
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
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 text-sm text-red-400 text-center">{error}</div>
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
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 transition-colors"
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
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 transition-colors pr-12"
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
