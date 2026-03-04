import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Shield, Wind, Activity, ArrowRight, Zap, MapPin, Heart, 
  Cpu, Network, Database, Cloud, LayoutDashboard, Brain, AlertTriangle, Radio
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';

// ── Helpers ──────────────────────────────────────────────────
const CountUp = ({ end, duration = 1500 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (typeof end !== 'number') return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);
  return <>{count}</>;
};

const ParticleFog = () => {
  // Generate a few large blurred circles that drift around to simulate atmospheric fog
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <motion.div 
        animate={{ x: [0, 100, -50, 0], y: [0, -50, 50, 0] }} 
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[100px]"
      />
      <motion.div 
        animate={{ x: [0, -100, 50, 0], y: [0, 100, -50, 0] }} 
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-[#10b981]/5 rounded-full blur-[120px]"
      />
      <motion.div 
        animate={{ x: [0, 50, -100, 0], y: [0, 50, -100, 0] }} 
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[40%] left-[60%] w-[600px] h-[600px] bg-[#f59e0b]/5 rounded-full blur-[150px]"
      />
    </div>
  );
};

// ── Landing Page Component ───────────────────────────────────
const Landing = () => {
  const navigate = useNavigate();
  const { data, fetchLatest } = useAerisStore();

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 8000);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  const aqi = data?.derived?.aqi || 0;
  const aqiCategory = data?.derived?.aqi_category || 'SYNCING';
  const rri = data?.derived?.rri || 0;
  const riskCategory = data?.derived?.risk_level || 'SYNCING';
  const riskColor = data?.derived?.risk_color || '#10b981';

  const [simulatedProfile, setSimulatedProfile] = useState({
    ageGroup: 'Elderly (65+)',
    asthma: true,
    smoking: false,
    conditions: 'None',
    multiplier: 1.35
  });

  const toggleAsthma = () => setSimulatedProfile(prev => ({ 
    ...prev, 
    asthma: !prev.asthma, 
    multiplier: prev.asthma ? 1.0 : 1.35 
  }));

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-100 font-sans selection:bg-sky-500/30 overflow-x-hidden relative">
      <ParticleFog />

      {/* ── Navbar ────────────────────────────────────────────── */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-linear-to-br from-sky-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Shield className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent block leading-none">AERIS</span>
            <span className="text-[9px] font-bold text-sky-400 uppercase tracking-widest">Intelligence</span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <button onClick={() => navigate('/login')} className="text-sm font-bold text-slate-400 hover:text-white transition-colors">LOGIN</button>
          <button onClick={() => navigate('/signup')} className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm font-bold text-white hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5 transition-all shadow-xl">
            SIGN UP
          </button>
        </div>
      </nav>

      {/* ── Section 1: Hero ────────────────────────────────────── */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="space-y-8">
            <div className="inline-flex items-center space-x-3 px-4 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-full mb-2">
              <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              <span className="text-[10px] font-black tracking-[0.2em] text-sky-400 uppercase">Live Intel Active</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-black leading-[1.05] tracking-tight">
              Know your air.<br />
              <span className="bg-linear-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent italic mr-2">
                Know your risk.
              </span>
            </h1>

            <p className="text-lg text-slate-400 max-w-lg leading-relaxed font-medium">
              We convert raw atmospheric telemetry into deeply personalized health intelligence. Protect your respiratory longevity in real-time.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-6">
              <button onClick={() => navigate('/dashboard')} className="group px-8 py-4 bg-linear-to-r from-sky-500 to-blue-600 rounded-full font-black text-white shadow-[0_0_30px_rgba(56,189,248,0.3)] hover:shadow-[0_0_40px_rgba(56,189,248,0.5)] hover:-translate-y-1 transition-all flex items-center space-x-3">
                <span>TRY DEMO MODE</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => navigate('/signup')} className="px-8 py-4 bg-[#111827]/60 backdrop-blur-md border border-white/10 rounded-full font-bold text-slate-300 hover:bg-white/5 hover:-translate-y-1 transition-all">
                Create Account
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.2 }} className="relative">
            <div className="grid gap-6 relative z-10">
              
              {/* AQI Live Card */}
              <div className="p-8 bg-[#111827]/80 backdrop-blur-2xl border border-white/5 hover:border-white/10 rounded-4xl shadow-2xl flex items-center justify-between group hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center space-x-6">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:bg-emerald-500/10 transition-colors">
                    <Wind className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">Live Environment</span>
                    <span className="text-xl font-bold">{aqiCategory}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">AQI INDEX</span>
                  <span className="text-6xl font-black text-white tracking-tighter block leading-none"><CountUp end={aqi} /></span>
                </div>
              </div>

              {/* RRI Live Card */}
              <div className="p-8 bg-[#111827]/80 backdrop-blur-2xl border flex items-center justify-between rounded-4xl shadow-2xl group hover:-translate-y-1 transition-all duration-300" style={{ borderColor: `${riskColor}22` }}>
                <div className="flex items-center space-x-6">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 transition-colors" style={{ backgroundColor: `${riskColor}15` }}>
                    <Activity className="w-8 h-8" style={{ color: riskColor }} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">Personalized</span>
                    <span className="text-xl font-bold" style={{ color: riskColor }}>{riskCategory}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: riskColor }}>RISK GAUGE</span>
                  <div className="flex items-baseline justify-end space-x-1">
                    <span className="text-6xl font-black text-white tracking-tighter block leading-none"><CountUp end={rri} /></span>
                    <span className="text-xl font-black text-slate-500">%</span>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </main>

      {/* ── Section 2: Feature Cards Grid ──────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-32 border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Unprecedented Awareness</h2>
          <p className="text-slate-400 font-medium">A unified suite delivering military-grade environmental telemetry.</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Radio, name: 'Real-Time Monitoring', desc: 'Continuous sub-10 second latency polling of all local IoT mesh nodes.' },
            { icon: MapPin, name: 'Hyperlocal Mapping', desc: 'High-resolution spatial grid detailing exact sector toxicity levels.' },
            { icon: Shield, name: 'Personalized Risk', desc: 'RRI algorithms adapt to your unique physiological baselines.' },
            { icon: Brain, name: 'AI Prediction', desc: 'Neural net trajectory forecasting for 6-hour atmospheric planning.' },
            { icon: Heart, name: 'Health Guidance', desc: 'Actionable, phase-based medical recommendations for mitigation.' },
            { icon: Network, name: 'Sensor Network', desc: 'Decentralized hardware grid spanning industrial to residential zones.' }
          ].map((f, i) => (
            <motion.div 
              key={f.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-[#111827]/40 backdrop-blur-md border border-white/5 rounded-4xl hover:-translate-y-2 hover:bg-[#111827]/80 hover:shadow-2xl hover:shadow-sky-500/10 transition-all duration-300 group"
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/5 group-hover:border-sky-500/30 group-hover:text-sky-400 transition-colors">
                <f.icon size={24} className="text-slate-400 group-hover:text-sky-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.name}</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Section 3: How AERIS Works ─────────────────────────── */}
      <section className="relative z-10 py-32 bg-linear-to-b from-transparent to-[#111827]/30 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">The Intelligence Flow</h2>
            <p className="text-slate-400 font-medium">Data lineage from atmospheric capture to personalized insight.</p>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {[
              { icon: Cpu, name: 'ESP32 Nodes', desc: 'Raw sensor capture', color: 'text-slate-300' },
              { icon: Cloud, name: 'AERIS Cloud', desc: 'Data ingestion & filtering', color: 'text-sky-400' },
              { icon: Brain, name: 'Risk Engine', desc: 'RRI multiplier compute', color: 'text-indigo-400' },
              { icon: LayoutDashboard, name: 'Dashboard', desc: 'Realtime visualization', color: 'text-emerald-400' }
            ].map((step, i, arr) => (
              <React.Fragment key={step.name}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                  className="w-full lg:w-64 p-8 bg-[#111827]/60 border border-white/5 rounded-4xl text-center relative z-10 hover:-translate-y-1 hover:shadow-2xl transition-all"
                >
                  <div className={`mx-auto w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/5 ${step.color}`}>
                    <step.icon size={32} />
                  </div>
                  <h4 className="font-bold text-lg mb-1">{step.name}</h4>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">{step.desc}</p>
                </motion.div>
                
                {i < arr.length - 1 && (
                  <div className="hidden lg:flex w-16 justify-center">
                    <motion.div 
                      animate={{ x: [0, 10, 0] }} 
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-white/20"
                    >
                      <ArrowRight size={32} />
                    </motion.div>
                  </div>
                )}
                {i < arr.length - 1 && (
                  <div className="lg:hidden h-12 flex items-center justify-center">
                    <motion.div 
                      animate={{ y: [0, 10, 0] }} 
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-white/20 rotate-90"
                    >
                      <ArrowRight size={24} />
                    </motion.div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Health Profile Demo ─────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-32 border-t border-white/5">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6">You are not a statistic.</h2>
            <p className="text-lg text-slate-400 font-medium mb-8 leading-relaxed">
              Standard AQI treats a professional athlete and an elderly asthma patient exactly the same. AERIS shifts the paradigm by applying a <strong>Personalized Risk Multiplier</strong> to base readings, outputting an RRI (Respiratory Risk Index) specifically tuned for your lungs.
            </p>
            <ul className="space-y-4">
              {[
                { label: 'Baseline calculation via standard EPA limits' },
                { label: 'Age & cardiovascular health weighting applied' },
                { label: 'Activity level multiplier integration' },
                { label: 'Pre-existing respiratory condition offsets factored' }
              ].map((item, i) => (
                <li key={i} className="flex items-center space-x-3 text-sm font-bold text-slate-300">
                  <div className="w-5 h-5 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center border border-sky-500/40">
                    <Zap size={10} />
                  </div>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#111827]/80 backdrop-blur-2xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px] rounded-full point-events-none" />
             
             <div className="flex items-center justify-between mb-8">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Profile Engine Simulator</h3>
               <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-sky-400 uppercase tracking-widest">Interactive</span>
             </div>

             <div className="space-y-6">
                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Pre-Existing Conditions</span>
                  <div className="flex rounded-xl overflow-hidden border border-white/10">
                    <button onClick={toggleAsthma} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${!simulatedProfile.asthma ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-slate-400'}`}>None</button>
                    <button onClick={toggleAsthma} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-l border-white/10 ${simulatedProfile.asthma ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-slate-400'}`}>Asthma</button>
                  </div>
                </div>

                <div className="p-5 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Base Atmospheric Toxins</span>
                    <span className="text-2xl font-black text-slate-300">50 AQI</span>
                  </div>
                  <div className="text-slate-600 font-bold">x</div>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 text-center">Multiplier</span>
                    <span className="text-2xl font-black text-sky-400 text-center block">{simulatedProfile.multiplier}</span>
                  </div>
                  <div className="text-slate-600 font-bold">=</div>
                  <div className="text-right">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Your True RRI</span>
                    <span className={`text-3xl font-black ${simulatedProfile.asthma ? 'text-red-400' : 'text-emerald-400'}`}>
                      {Math.round(50 * simulatedProfile.multiplier)}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-start space-x-3">
                  <AlertTriangle size={16} className={simulatedProfile.asthma ? 'text-amber-400 shrink-0 mt-0.5' : 'text-slate-500 shrink-0 mt-0.5'} />
                  <p className="text-xs font-medium text-slate-300 leading-relaxed">
                    {simulatedProfile.asthma 
                      ? "Because you have asthma, an AQI of 50 translates to an effective risk of 68. Moderate caution advised for outdoor exertion."
                      : "With no pre-existing conditions, an AQI of 50 poses minimal risk to your respiratory system. Clear for all activities."
                    }
                  </p>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-12 px-8 bg-[#111827]/40 text-center">
        <div className="w-10 h-10 mx-auto bg-linear-to-br from-sky-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20 mb-6">
          <Shield className="text-white w-5 h-5" />
        </div>
        <div className="text-2xl font-black tracking-tighter mb-2">AERIS_CORE</div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Personalized Respiratory Protection System</p>
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
          SYSTEM_ALPHA_SYNCED • SENSORS: {data?.nodes?.length || 0} ACTIVE • V2.0.4
        </div>
      </footer>
    </div>
  );
};

export default Landing;
