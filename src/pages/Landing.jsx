import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Wind, Activity, ArrowRight, Eye, Heart, Cloud, ActivitySquare, LayoutDashboard, ShieldCheck, Github, Twitter, MapPin } from 'lucide-react';
import useAerisStore from '@/store/aerisStore';

// Keep helpers to not break any external/internal expectations
const getAqiColor = (aqi) => {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  return '#7c3aed';
};

const getAqiLabel = (aqi) => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  return 'Hazardous';
};

const Landing = () => {
  const navigate = useNavigate();
  
  // Untouched state logic
  const data = useAerisStore((s) => s.data);
  const aqi = data?.derived?.aqi || 0;
  const rri = data?.derived?.rri || 0;
  const riskColor = data?.derived?.risk_color || '#10b981';
  const nodeCount = data?.nodes?.length || 0;
  const aqiColor = getAqiColor(aqi);

  const [hasAsthma, setHasAsthma] = useState(true);
  const multiplier = hasAsthma ? 1.35 : 1.0;

  return (
    <div className="min-h-screen text-slate-100 font-sans bg-slate-900 overflow-x-hidden">
      {/* ── Navbar ─────────────────────────────────────── */}
      <nav className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center">
          <img src="/logo-aeris.png" alt="AERIS" className="h-20 w-auto object-contain drop-shadow-md" />
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/login')} className="text-sm font-semibold text-slate-200 hover:text-white transition-colors drop-shadow-md">
            Log in
          </button>
          <button onClick={() => navigate('/signup')} className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 rounded-full text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition-all hover:scale-105">
            Get Started
          </button>
        </div>
      </nav>

      {/* ── 1. Hero Section ────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 pt-20">
        <div className="absolute inset-0 z-0">
          <img src="/hero-bg.jpg" alt="Mountain valley" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-b from-slate-900/40 via-slate-900/60 to-slate-900" />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full mb-6 border border-white/20">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-white">Live Environmental Intelligence</span>
            </div>
            
            <h1 className="font-extrabold tracking-tight text-white drop-shadow-xl mb-6 leading-tight flex flex-col items-center">
              <span className="text-7xl md:text-8xl lg:text-9xl text-transparent bg-clip-text bg-linear-to-r from-(--color-primary) to-(--color-secondary) tracking-wide pb-2">AERIS</span>
              <span className="text-4xl md:text-5xl lg:text-6xl mt-4">The Smartest Way <br/> to Check Your Space</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-light drop-shadow-md">
              Real-time air quality tracking, pollution data visualization, and personalized health risks. Understand what you breathe, before you step outside.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => navigate('/dashboard')} className="w-full sm:w-auto px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white rounded-full font-bold text-lg shadow-xl shadow-sky-500/20 transition-all hover:scale-105 flex items-center justify-center gap-2">
                <LayoutDashboard className="w-5 h-5" /> View Dashboard
              </button>
              <button onClick={() => navigate('/signup')} className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full font-bold text-lg transition-all hover:scale-105 flex items-center justify-center gap-2">
                Get Started <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 2. Features Section ────────────────────────── */}
      <section className="py-24 px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-sky-400 tracking-widest uppercase mb-2">Core Capabilities</h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-white">Actionable Air Quality Insights</h3>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Wind, title: 'Real-time AQI Monitoring', desc: 'Continuous tracking of PM2.5, PM10, and overarching Air Quality Index with immediate alerts.' },
            { icon: Activity, title: 'Data Visualization', desc: 'Clear, intuitive graphs and spatial mapping of local and regional pollutant concentrations.' },
            { icon: Heart, title: 'Personal Exposure Risk', desc: 'Custom Health Risk Indices computed from your personal profiles and current environmental metrics.' },
            { icon: Cloud, title: 'Environmental Insights', desc: 'Predictive forecasting and trend analysis to help you plan outdoor activities safely.' }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 p-8 rounded-2xl hover:bg-slate-800 transition-colors group"
            >
              <div className="w-14 h-14 bg-slate-700/50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform group-hover:bg-sky-500/20">
                <feature.icon className="w-7 h-7 text-sky-400" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">{feature.title}</h4>
              <p className="text-slate-400 font-light leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 3. Platform Overview ───────────────────────── */}
      <section className="py-24 bg-slate-900 border-y border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-sky-500/10 blur-[100px] rounded-full" />
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
              More than just data. <br/>
              <span className="text-slate-400">Meaningful protection.</span>
            </h2>
            <p className="text-lg text-slate-300 font-light leading-relaxed mb-8">
              AERIS uses highly accurate IoT sensors distributed across the region to stream environmental parameters instantly. We take complex meteorological and pollutant data and translate it into a single, understandable platform. 
              <br/><br/>
              The system adjusts its guidance based on the unique health profiles you provide, making recommendations truly customized to your respiratory situation.
            </p>
            
            <ul className="space-y-4 mb-8">
              {['End-to-end encryption for health data', 'Hyper-local node data via Map View', 'Personal modifiers adjusting base AQI dynamically'].map((text, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-300 font-medium">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  {text}
                </li>
              ))}
            </ul>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl p-8 bg-linear-to-br from-slate-800 to-slate-800/50 border border-slate-700 shadow-2xl relative"
          >
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay rounded-3xl" />
             
             {/* Abstract visual representation */}
             <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="p-6 bg-slate-900 rounded-2xl border border-slate-700">
                  <Activity className="w-8 h-8 text-rose-400 mb-4" />
                  <div className="text-2xl font-black text-white">42 µg/m³</div>
                  <div className="text-sm text-slate-400 mt-1">PM2.5 Level</div>
                </div>
                <div className="p-6 bg-slate-900 rounded-2xl border border-slate-700 translate-y-6">
                  <MapPin className="w-8 h-8 text-sky-400 mb-4" />
                  <div className="text-2xl font-black text-white">6</div>
                  <div className="text-sm text-slate-400 mt-1">Active Nodes</div>
                </div>
                <div className="p-6 bg-slate-900 rounded-2xl border border-slate-700 -translate-y-6">
                  <Heart className="w-8 h-8 text-emerald-400 mb-4" />
                  <div className="text-2xl font-black text-white">Low</div>
                  <div className="text-sm text-slate-400 mt-1">Risk Profile</div>
                </div>
                <div className="p-6 bg-slate-900 rounded-2xl border border-slate-700 flex flex-col justify-center items-center text-center">
                   <div className="w-16 h-16 rounded-full border-4 border-sky-500 flex items-center justify-center mb-3">
                      <span className="text-xl font-bold text-white">50</span>
                   </div>
                   <div className="text-sm font-bold text-sky-400">AQI</div>
                </div>
             </div>
          </motion.div>
        </div>
      </section>

      {/* ── 4. Call to Action ──────────────────────────── */}
      <section className="py-24 relative px-6">
        <div className="max-w-5xl mx-auto bg-linear-to-r from-sky-600 to-blue-700 rounded-3xl p-10 md:p-16 text-center shadow-2xl shadow-sky-900/40 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full" />
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 blur-3xl rounded-full" />
           
           <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 relative z-10">Ready to monitor your environment?</h2>
           <p className="text-sky-100 text-lg md:text-xl font-light mb-10 max-w-2xl mx-auto relative z-10">
             Join AERIS today and start leveraging cutting-edge sensor arrays to understand exactly what you and your family are breathing.
           </p>
           
           <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <button onClick={() => navigate('/signup')} className="w-full sm:w-auto px-8 py-4 bg-white text-blue-600 hover:bg-slate-100 rounded-full font-bold text-lg shadow-xl shadow-black/10 transition-transform hover:scale-105">
              Create Free Account
            </button>
            <button onClick={() => navigate('/pollutants')} className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-white/30 text-white hover:bg-white/10 rounded-full font-bold text-lg transition-all">
              Explore Data
            </button>
           </div>
        </div>
      </section>

      {/* ── 5. Footer ──────────────────────────────────── */}
      <footer className="bg-slate-950 py-12 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center">
            <img src="/logo-aeris.png" alt="AERIS" className="h-16 w-auto object-contain" />
          </div>
          
          <div className="flex gap-8 text-sm font-medium text-slate-400">
            <button onClick={() => navigate('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
            <button onClick={() => navigate('/map')} className="hover:text-white transition-colors">Map</button>
            <button onClick={() => navigate('/profile')} className="hover:text-white transition-colors">Profile</button>
          </div>
          
          <div className="text-sm font-light text-slate-500">
            &copy; {new Date().getFullYear()} AERIS Intelligence. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
