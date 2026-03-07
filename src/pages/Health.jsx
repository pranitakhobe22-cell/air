import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Shield, AlertTriangle, Activity, Thermometer,
  Droplets, Wind, User, CheckCircle2
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';
import useActiveNode from '@/hooks/useActiveNode';

const sensitiveTabs = [
  { id: 'asthma', label: 'Asthma/COPD', icon: Activity, threshold: 40 },
  { id: 'children', label: 'Children', icon: User, threshold: 50 },
  { id: 'elderly', label: 'Elderly', icon: User, threshold: 45 },
  { id: 'heart', label: 'Heart Patients', icon: Heart, threshold: 45 },
  { id: 'smokers', label: 'Smokers', icon: Wind, threshold: 60 },
];

const Health = () => {
  const active = useActiveNode();
  const [activeTab, setActiveTab] = useState(sensitiveTabs[0]);

  if (!active.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { derived, environment, sensors } = active;
  const rri = derived.rri || 50;
  const pm25 = sensors?.pm25 || 35;
  const temp = environment?.temperature || 25;

  const needsMask = rri >= 50;
  const outdoorLimit = rri >= 80 ? 'Avoid outdoors' : rri >= 60 ? '1-2 hrs max' : rri >= 40 ? '4-5 hrs' : 'Unlimited';
  const hydrationOz = Math.floor(64 * (temp > 30 ? 1.5 : temp > 25 ? 1.2 : 1.0));
  const isDanger = rri >= activeTab.threshold;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Health Center</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {active.isNodeView ? `${active.nodeName} — ` : ''}Health guidance and recommendations based on current conditions.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* Left */}
        <div className="xl:col-span-8 space-y-5">

          {/* Guidance cards */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-5">Current Guidance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                {
                  label: 'Respirator',
                  value: needsMask ? 'N95 Required' : 'Not Needed',
                  icon: Shield,
                  color: needsMask ? 'text-amber-400' : 'text-emerald-400',
                  bg: needsMask ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-900/50 border-slate-700/30',
                },
                {
                  label: 'Outdoor Limit',
                  value: outdoorLimit,
                  icon: Thermometer,
                  color: 'text-sky-400',
                  bg: 'bg-slate-900/50 border-slate-700/30',
                },
                {
                  label: 'Daily Intake',
                  value: `${hydrationOz} oz water`,
                  icon: Droplets,
                  color: 'text-blue-400',
                  bg: 'bg-slate-900/50 border-slate-700/30',
                },
                {
                  label: 'Breathing',
                  value: '4-7-8 Rhythm',
                  icon: Wind,
                  color: 'text-purple-400',
                  bg: 'bg-slate-900/50 border-slate-700/30',
                },
              ].map((g) => (
                <div key={g.label} className={`p-5 rounded-xl border ${g.bg}`}>
                  <g.icon size={18} className={`${g.color} mb-3`} />
                  <p className="text-xs text-slate-500 mb-1">{g.label}</p>
                  <p className={`text-sm font-semibold ${g.color}`}>{g.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700/40 flex items-center gap-2 text-sm text-slate-400">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>
                {rri < 40
                  ? 'Deep breathing exercises recommended. Air quality supports normal activity.'
                  : 'Switch to shallow, indoor breathing exercises. Minimize outdoor exertion.'}
              </span>
            </div>
          </div>

          {/* Sensitive Group Tabs */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
              <h3 className="text-sm font-semibold text-slate-300">Sensitive Groups</h3>
              <div className="flex flex-wrap gap-1.5">
                {sensitiveTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab.id === tab.id
                        ? 'bg-sky-500/15 text-sky-400'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className={`p-5 rounded-xl border ${isDanger ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-900/50 border-slate-700/30'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    {isDanger ? <AlertTriangle size={16} className="text-red-400" /> : <CheckCircle2 size={16} className="text-emerald-400" />}
                    <span className={`text-sm font-semibold ${isDanger ? 'text-red-400' : 'text-emerald-400'}`}>
                      {isDanger ? 'Caution Required' : 'Normal Activity OK'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Current RRI is {rri}. The {activeTab.label} threshold is {activeTab.threshold}.
                    {isDanger
                      ? ' Conditions exceed safe levels for this group. Limit outdoor exposure.'
                      : ' Present conditions are within safe parameters.'}
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-700/30">
                  <p className="text-xs text-slate-500 mb-3">Recommendations</p>
                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 bg-sky-400 rounded-full mt-1.5 shrink-0" />
                      <span className="text-sm text-slate-300">Keep rescue medications accessible at all times.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 bg-sky-400 rounded-full mt-1.5 shrink-0" />
                      <span className="text-sm text-slate-300">Set HVAC to recirculate with HEPA filtration.</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right */}
        <div className="xl:col-span-4 space-y-5">

          {/* Emergency */}
          <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Heart size={16} className="text-red-400" />
              <h3 className="text-sm font-semibold text-red-400">Emergency Signs</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Seek immediate medical help if experiencing:</p>
            <div className="space-y-2">
              {[
                'Severe shortness of breath',
                'Chest pain or tightness',
                'Prolonged dizziness',
                'Blue lips or fingertips',
                'Uncontrollable coughing',
              ].map((s) => (
                <div key={s} className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                  <AlertTriangle size={12} className="text-red-400 shrink-0" />
                  <span className="text-sm text-slate-300">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WHO Standards */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">WHO Guidelines</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              WHO recommends annual PM2.5 averages below 5 ug/m3 and 24-hour exposures below 15 ug/m3.
            </p>
            <div className="p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">Current PM2.5</span>
                <span className="text-xs font-semibold text-rose-400">{pm25} ug/m3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">WHO 24hr Limit</span>
                <span className="text-xs font-semibold text-emerald-400">15 ug/m3</span>
              </div>
              <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-rose-500 rounded-full"
                  style={{ width: `${Math.min((pm25 / 15) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Health;
