import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Wind, Activity, ArrowRight, MapPin, Heart,
  Cpu, Cloud, LayoutDashboard, Brain, ChevronRight, Check
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';

/* ── AQI color helper ──────────────────────────────────── */
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

/* ── Landing Page ──────────────────────────────────────── */
const Landing = () => {
  const navigate = useNavigate();
  const data = useAerisStore((s) => s.data);

  const aqi = data?.derived?.aqi || 0;
  const rri = data?.derived?.rri || 0;
  const riskColor = data?.derived?.risk_color || '#10b981';
  const nodeCount = data?.nodes?.length || 0;
  const aqiColor = getAqiColor(aqi);

  const [hasAsthma, setHasAsthma] = useState(true);
  const multiplier = hasAsthma ? 1.35 : 1.0;

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-100 font-sans overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-4 sm:px-6 md:px-10 py-4 sm:py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white">AERIS</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/login')} className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
            Log in
          </button>
          <button onClick={() => navigate('/signup')} className="px-5 py-2 bg-sky-500 hover:bg-sky-400 rounded-lg text-sm font-semibold text-white transition-colors">
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 pt-10 sm:pt-16 pb-16 sm:pb-24">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-full mb-4 sm:mb-6">
              <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-sky-400">Live monitoring active</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight mb-4 sm:mb-6">
              Air quality,{' '}
              <span className="text-sky-400">personalized</span>
              <br />to your health.
            </h1>

            <p className="text-base sm:text-lg text-slate-400 max-w-lg leading-relaxed mb-6 sm:mb-8">
              AERIS combines real-time sensor data with your health profile to deliver a personal respiratory risk score — not just a generic AQI number.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/signup')}
                className="flex items-center gap-2 px-7 py-3.5 bg-sky-500 hover:bg-sky-400 rounded-lg font-semibold text-white transition-colors"
              >
                Start Monitoring <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-7 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-semibold text-slate-300 transition-colors"
              >
                Try Demo
              </button>
            </div>
          </motion.div>

          {/* Live data cards */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="space-y-4">
            {/* AQI Card */}
            <div className="p-6 bg-slate-800/60 border border-slate-700/50 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${aqiColor}15` }}>
                  <Wind className="w-6 h-6" style={{ color: aqiColor }} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Air Quality Index</p>
                  <p className="text-sm font-semibold" style={{ color: aqiColor }}>{getAqiLabel(aqi)}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-4xl font-extrabold text-white tabular-nums">{aqi}</span>
                <p className="text-xs text-slate-500 mt-0.5">AQI</p>
              </div>
            </div>

            {/* RRI Card */}
            <div className="p-6 bg-slate-800/60 border border-slate-700/50 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${riskColor}15` }}>
                  <Activity className="w-6 h-6" style={{ color: riskColor }} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Respiratory Risk Index</p>
                  <p className="text-sm font-semibold" style={{ color: riskColor }}>
                    {rri <= 40 ? 'Low' : rri <= 70 ? 'Moderate' : 'High'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-4xl font-extrabold text-white tabular-nums">{rri}</span>
                <p className="text-xs text-slate-500 mt-0.5">RRI</p>
              </div>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Sensors', value: nodeCount || 6 },
                { label: 'Pollutants', value: 5 },
                { label: 'Update', value: '10s' },
              ].map((s) => (
                <div key={s.label} className="p-4 bg-slate-800/40 border border-slate-700/40 rounded-xl text-center">
                  <div className="text-xl font-bold text-white">{s.value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-20 border-t border-slate-800">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3">What makes AERIS different</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Real hardware, real-time data, and personalized risk analysis — not just another weather widget.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Wind, name: 'Real-Time Sensors', desc: 'ESP32-based nodes capture PM2.5, O3, CO, NO2, VOCs and environmental data every 10 seconds.' },
            { icon: MapPin, name: 'Hyperlocal Coverage', desc: 'Sector-level mapping shows air quality variations across your neighborhood, not just your city.' },
            { icon: Shield, name: 'Personal Risk Score', desc: 'Your RRI factors in age, respiratory conditions, and activity level for a truly personal assessment.' },
            { icon: Brain, name: 'Trend Forecasting', desc: 'Track air quality patterns and get 6-hour forecasts to plan outdoor activities safely.' },
            { icon: Heart, name: 'Health Guidance', desc: 'Receive actionable recommendations based on your health profile and current conditions.' },
            { icon: Cloud, name: 'Sensor Network', desc: 'Distributed IoT mesh across residential and industrial zones for comprehensive coverage.' },
          ].map((f, i) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-6 bg-slate-800/40 border border-slate-700/40 rounded-xl hover:border-slate-600/60 transition-colors"
            >
              <div className="w-10 h-10 bg-sky-500/10 rounded-lg flex items-center justify-center mb-4">
                <f.icon size={20} className="text-sky-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">{f.name}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-20 border-t border-slate-800">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3">How it works</h2>
          <p className="text-slate-400">From sensor to screen in under 10 seconds.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Cpu, step: '01', name: 'Sensor Capture', desc: 'ESP32 nodes read atmospheric data from calibrated gas and particulate sensors.' },
            { icon: Cloud, step: '02', name: 'Cloud Ingestion', desc: 'Readings are validated, processed, and stored with sub-second latency.' },
            { icon: Brain, step: '03', name: 'Risk Computation', desc: 'AQI is calculated per EPA standards, then personalized into your RRI.' },
            { icon: LayoutDashboard, step: '04', name: 'Live Dashboard', desc: 'Real-time visualization with alerts, trends, and health recommendations.' },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 bg-slate-800/40 border border-slate-700/40 rounded-xl text-center"
            >
              <div className="text-xs font-bold text-sky-400 mb-3">{s.step}</div>
              <div className="w-12 h-12 mx-auto bg-slate-700/50 rounded-xl flex items-center justify-center mb-4">
                <s.icon size={24} className="text-slate-300" />
              </div>
              <h4 className="font-bold text-white mb-1.5">{s.name}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Personalization Demo ───────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-20 border-t border-slate-800">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Not all lungs are equal</h2>
            <p className="text-lg text-slate-400 leading-relaxed mb-6">
              A standard AQI of 50 means different things for a healthy adult vs. someone with asthma. AERIS applies a personal risk multiplier based on your health profile.
            </p>
            <ul className="space-y-3">
              {[
                'EPA-standard AQI as baseline',
                'Age and cardiovascular health weighting',
                'Respiratory condition adjustments',
                'Activity level factored in',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                  <Check size={16} className="text-sky-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Interactive demo card */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-5">Try it: toggle condition</p>

            <div className="flex rounded-lg overflow-hidden border border-slate-700 mb-6">
              <button
                onClick={() => setHasAsthma(false)}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${!hasAsthma ? 'bg-sky-500/20 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Healthy
              </button>
              <button
                onClick={() => setHasAsthma(true)}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-l border-slate-700 ${hasAsthma ? 'bg-red-500/15 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Asthma
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 p-5 bg-slate-900/60 rounded-xl border border-slate-700/40 mb-4">
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-1">Base AQI</p>
                <p className="text-2xl font-bold text-white">50</p>
              </div>
              <span className="text-slate-600 font-bold text-lg">&times;</span>
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-1">Multiplier</p>
                <p className="text-2xl font-bold text-sky-400">{multiplier.toFixed(2)}</p>
              </div>
              <span className="text-slate-600 font-bold text-lg">=</span>
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-1">Your RRI</p>
                <p className={`text-2xl font-bold ${hasAsthma ? 'text-red-400' : 'text-emerald-400'}`}>
                  {Math.round(50 * multiplier)}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              {hasAsthma
                ? 'With asthma, an AQI of 50 translates to a personal risk score of 68. Moderate caution is advised for outdoor activities.'
                : 'With no conditions, an AQI of 50 poses minimal respiratory risk. All activities are safe.'
              }
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-20 border-t border-slate-800">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Start protecting your lungs today</h2>
          <p className="text-slate-400 mb-8">Create a free account to set up your health profile and get personalized air quality insights.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('/signup')}
              className="flex items-center gap-2 px-8 py-3.5 bg-sky-500 hover:bg-sky-400 rounded-lg font-semibold text-white transition-colors"
            >
              Create Free Account <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-8 sm:py-10 px-4 sm:px-6 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-blue-600 rounded-md flex items-center justify-center">
              <Shield className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-400">AERIS</span>
          </div>
          <p className="text-xs text-slate-600">
            {nodeCount || 6} sensors active &middot; Real-time environmental monitoring
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
