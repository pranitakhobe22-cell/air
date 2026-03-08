import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Wind, Activity, ArrowRight, MapPin, Heart,
  Cpu, Cloud, LayoutDashboard, Brain, Check
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';

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
  const data = useAerisStore((s) => s.data);

  const aqi = data?.derived?.aqi || 0;
  const rri = data?.derived?.rri || 0;
  const riskColor = data?.derived?.risk_color || '#10b981';
  const nodeCount = data?.nodes?.length || 0;
  const aqiColor = getAqiColor(aqi);

  const [hasAsthma, setHasAsthma] = useState(true);
  const multiplier = hasAsthma ? 1.35 : 1.0;

  return (
    <div className="min-h-screen bg-[#060910] text-slate-100 font-sans overflow-x-hidden">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-5 sm:px-8 md:px-12 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Shield className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">AERIS</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors rounded-lg">
            Log in
          </button>
          <button onClick={() => navigate('/signup')} className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 md:px-12 pt-12 sm:pt-20 pb-20 sm:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/[0.05] rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-slate-400">Live monitoring active</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] lg:text-6xl font-extrabold leading-[1.08] tracking-tight mb-6">
              Air quality,{' '}
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">personalized</span>
              <br />to your health.
            </h1>

            <p className="text-lg text-slate-400 max-w-lg leading-relaxed mb-8">
              AERIS combines real-time sensor data with your health profile to deliver a personal respiratory risk score — not just a generic AQI number.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/signup')}
                className="flex items-center gap-2 px-7 py-3.5 bg-sky-500 hover:bg-sky-400 rounded-xl font-semibold text-white transition-all shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5"
              >
                Start Monitoring <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-7 py-3.5 bg-white/[0.06] hover:bg-white/[0.1] rounded-xl font-semibold text-slate-300 transition-all"
              >
                Try Demo
              </button>
            </div>
          </motion.div>

          {/* Live data cards */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }} className="space-y-4">
            <div className="p-6 bg-white/[0.04] rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${aqiColor}12` }}>
                  <Wind className="w-6 h-6" style={{ color: aqiColor }} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Air Quality Index</p>
                  <p className="text-sm font-semibold" style={{ color: aqiColor }}>{getAqiLabel(aqi)}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-4xl font-extrabold text-white tabular-nums">{aqi}</span>
                <p className="text-[11px] text-slate-600 mt-0.5">AQI</p>
              </div>
            </div>

            <div className="p-6 bg-white/[0.04] rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${riskColor}12` }}>
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
                <p className="text-[11px] text-slate-600 mt-0.5">RRI</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Sensors', value: nodeCount || 3 },
                { label: 'Pollutants', value: 5 },
                { label: 'Update', value: '10s' },
              ].map((s) => (
                <div key={s.label} className="p-4 bg-white/[0.03] rounded-xl text-center">
                  <div className="text-xl font-bold text-white">{s.value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 md:px-12 py-16 sm:py-24 border-t border-white/[0.05]">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">What makes AERIS different</h2>
          <p className="text-slate-500 max-w-xl mx-auto text-lg">Real hardware, real-time data, and personalized risk analysis — not just another weather widget.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              transition={{ delay: i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
              className="group p-6 bg-white/[0.03] rounded-2xl hover:bg-white/[0.06] transition-all duration-300"
            >
              <div className="w-11 h-11 bg-sky-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <f.icon size={20} className="text-sky-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-2">{f.name}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 md:px-12 py-16 sm:py-24 border-t border-white/[0.05]">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">How it works</h2>
          <p className="text-slate-500 text-lg">From sensor to screen in under 10 seconds.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              transition={{ delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
              className="p-6 bg-white/[0.03] rounded-2xl text-center"
            >
              <div className="text-[11px] font-bold text-sky-400/60 tracking-widest mb-4">{s.step}</div>
              <div className="w-12 h-12 mx-auto bg-white/[0.05] rounded-xl flex items-center justify-center mb-4">
                <s.icon size={22} className="text-slate-300" />
              </div>
              <h4 className="font-semibold text-white mb-2">{s.name}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Personalization Demo */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 md:px-12 py-16 sm:py-24 border-t border-white/[0.05]">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-5">Not all lungs are equal</h2>
            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              A standard AQI of 50 means different things for a healthy adult vs. someone with asthma. AERIS applies a personal risk multiplier based on your health profile.
            </p>
            <ul className="space-y-3.5">
              {[
                'EPA-standard AQI as baseline',
                'Age and cardiovascular health weighting',
                'Respiratory condition adjustments',
                'Activity level factored in',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[15px] text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-sky-400" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white/[0.04] rounded-2xl p-7">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-6">Try it: toggle condition</p>

            <div className="flex rounded-xl overflow-hidden bg-white/[0.04] mb-6">
              <button
                onClick={() => setHasAsthma(false)}
                className={`flex-1 py-3 text-sm font-semibold transition-all ${!hasAsthma ? 'bg-sky-500/15 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Healthy
              </button>
              <button
                onClick={() => setHasAsthma(true)}
                className={`flex-1 py-3 text-sm font-semibold transition-all ${hasAsthma ? 'bg-red-500/12 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Asthma
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 p-5 bg-[#060910] rounded-xl mb-5">
              <div className="text-center">
                <p className="text-[11px] text-slate-600 mb-1.5">Base AQI</p>
                <p className="text-2xl font-bold text-white">50</p>
              </div>
              <span className="text-slate-700 font-bold text-lg">&times;</span>
              <div className="text-center">
                <p className="text-[11px] text-slate-600 mb-1.5">Multiplier</p>
                <p className="text-2xl font-bold text-sky-400">{multiplier.toFixed(2)}</p>
              </div>
              <span className="text-slate-700 font-bold text-lg">=</span>
              <div className="text-center">
                <p className="text-[11px] text-slate-600 mb-1.5">Your RRI</p>
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

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 md:px-12 py-16 sm:py-24 border-t border-white/[0.05]">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-5">Start protecting your lungs today</h2>
          <p className="text-slate-500 text-lg mb-8">Create a free account to set up your health profile and get personalized air quality insights.</p>
          <button
            onClick={() => navigate('/signup')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-sky-500 hover:bg-sky-400 rounded-xl font-semibold text-white transition-all shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5"
          >
            Create Free Account <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-10 px-5 sm:px-8 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-lg flex items-center justify-center">
              <Shield className="text-white w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm text-slate-500">AERIS</span>
          </div>
          <p className="text-xs text-slate-600">
            {nodeCount || 3} sensors active &middot; Real-time environmental monitoring
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
