import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Wind, Shield } from 'lucide-react';
import { login, registerUser } from '@/services/auth';

const Login = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  useEffect(() => {
    document.body.classList.add('dashboard-bg');
    return () => document.body.classList.remove('dashboard-bg');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);
    if (signupPassword !== signupConfirm) { setError('Passwords do not match.'); return; }
    if (signupPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await registerUser(signupName, signupEmail, signupPassword);
      navigate('/onboarding');
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => { setError(null); setIsLogin(!isLogin); };

  const inputClass = 'w-full bg-transparent border-b-2 border-slate-300/30 px-1 py-3 text-sm text-(--color-text-primary) placeholder:text-(--color-text-secondary)/40 outline-none transition-all duration-300 focus:border-(--color-accent) focus:shadow-[0_2px_12px_rgba(6,182,212,0.15)]';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[860px]"
      >
        <div className="glass-card rounded-2xl shadow-2xl border border-white/30 overflow-hidden relative" style={{ minHeight: 520 }}>

          {/* ── Both forms always rendered side by side ─── */}
          <div className="flex" style={{ minHeight: 520 }}>

            {/* Left half — Login form */}
            <div className="w-1/2 p-8 sm:p-10 flex flex-col justify-center">
              <motion.div animate={{ opacity: isLogin ? 1 : 0.3, scale: isLogin ? 1 : 0.97, filter: isLogin ? 'blur(0px)' : 'blur(2px)' }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ pointerEvents: isLogin ? 'auto' : 'none' }}
              >
                <h2 className="text-2xl font-bold text-(--color-text-primary) mb-1">Sign In</h2>
                <p className="text-xs text-(--color-text-secondary) mb-8">Access your AERIS dashboard</p>

                {error && isLogin && <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 mb-5 text-xs text-rose-500 text-center font-medium">{error}</div>}

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest block mb-1.5">Email</label>
                    <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@email.com" required={isLogin} className={inputClass} tabIndex={isLogin ? 0 : -1} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest block mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••" required={isLogin} className={`${inputClass} pr-10`} tabIndex={isLogin ? 0 : -1} />
                      {isLogin && (
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors">
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                    </div>
                  </div>
                  <button type="submit" disabled={loading || !isLogin} tabIndex={isLogin ? 0 : -1}
                    className="w-full py-3.5 bg-linear-to-r from-(--color-primary) to-(--color-secondary) rounded-xl text-xs font-black uppercase tracking-widest text-white hover:opacity-90 shadow-lg shadow-(--color-primary)/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                    <span>{loading && isLogin ? 'Signing In...' : 'Sign In'}</span>
                    {!(loading && isLogin) && <ArrowRight size={14} />}
                  </button>
                </form>
              </motion.div>
            </div>

            {/* Right half — Signup form */}
            <div className="w-1/2 p-8 sm:p-10 flex flex-col justify-center">
              <motion.div animate={{ opacity: !isLogin ? 1 : 0.3, scale: !isLogin ? 1 : 0.97, filter: !isLogin ? 'blur(0px)' : 'blur(2px)' }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ pointerEvents: !isLogin ? 'auto' : 'none' }}
              >
                <h2 className="text-2xl font-bold text-(--color-text-primary) mb-1">Create Account</h2>
                <p className="text-xs text-(--color-text-secondary) mb-5">Join AERIS — breathe smarter</p>

                {error && !isLogin && <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 mb-4 text-xs text-rose-500 text-center font-medium">{error}</div>}

                <form onSubmit={handleSignup} className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest block mb-1">Full Name</label>
                    <input type="text" value={signupName} onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Your name" required={!isLogin} className={inputClass} tabIndex={!isLogin ? 0 : -1} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest block mb-1">Email</label>
                    <input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="you@email.com" required={!isLogin} className={inputClass} tabIndex={!isLogin ? 0 : -1} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest block mb-1">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="Min 6 characters" required={!isLogin} className={`${inputClass} pr-10`} tabIndex={!isLogin ? 0 : -1} />
                      {!isLogin && (
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors">
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest block mb-1">Confirm Password</label>
                    <input type="password" value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)}
                      placeholder="••••••••" required={!isLogin} className={inputClass} tabIndex={!isLogin ? 0 : -1} />
                  </div>
                  <button type="submit" disabled={loading || isLogin} tabIndex={!isLogin ? 0 : -1}
                    className="w-full mt-1 py-3.5 bg-linear-to-r from-(--color-primary) to-(--color-secondary) rounded-xl text-xs font-black uppercase tracking-widest text-white hover:opacity-90 shadow-lg shadow-(--color-primary)/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                    <span>{loading && !isLogin ? 'Creating...' : 'Create Account'}</span>
                    {!(loading && !isLogin) && <ArrowRight size={14} />}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>

          {/* ── Sliding Branding Overlay ─────────────────── */}
          <motion.div
            className="absolute top-0 bottom-0 w-1/2 z-20 flex flex-col items-center justify-center p-10 text-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
            animate={{ left: isLogin ? '50%' : '0%' }}
            transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
          >
            {/* Floating orbs */}
            <motion.div className="absolute w-56 h-56 rounded-full bg-white/8 blur-3xl"
              animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ top: '-15%', right: '-10%' }} />
            <motion.div className="absolute w-40 h-40 rounded-full bg-white/5 blur-2xl"
              animate={{ x: [0, -15, 0], y: [0, 10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              style={{ bottom: '-10%', left: '-5%' }} />

            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'b-login' : 'b-signup'}
                initial={{ opacity: 0, y: 15, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.92 }}
                transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10"
              >
                <motion.div
                  className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mx-auto mb-5 border border-white/20"
                  animate={{ rotate: [0, 3, -3, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {isLogin ? <Shield size={26} className="text-white" /> : <Wind size={26} className="text-white" />}
                </motion.div>

                <h2 className="text-2xl font-bold text-white mb-2.5">
                  {isLogin ? 'Welcome Back!' : 'Join AERIS'}
                </h2>
                <p className="text-sm text-white/75 leading-relaxed max-w-[230px] mx-auto mb-8">
                  {isLogin
                    ? 'Your environment awaits. Sign in to access real-time intelligence.'
                    : 'Start tracking air quality and get personalised health insights.'}
                </p>

                <motion.button
                  onClick={switchMode}
                  className="px-7 py-2.5 rounded-full border-2 border-white/30 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/15 transition-all"
                  whileHover={{ scale: 1.05, borderColor: 'rgba(255,255,255,0.5)' }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isLogin ? 'Create Account' : 'Sign In Instead'}
                </motion.button>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        <div className="text-center mt-5">
          <Link to="/" className="text-xs text-(--color-text-secondary) hover:text-(--color-accent) transition-colors">← Back to home</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
