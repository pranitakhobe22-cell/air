import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Network as NetIcon, Server, Database, Activity, Wifi,
  Cpu, Clock, ChevronDown, ChevronUp, AlertCircle, ShieldCheck
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';

const learningData = [
  {
    id: 'aqi',
    title: 'What is AQI?',
    content: 'The Air Quality Index (AQI) is a standard for reporting daily air quality. It calculates the concentration of 6 major pollutants (PM2.5, PM10, O3, NO2, CO, VOCs) into a single score from 0-500, indicating how clean or polluted the air is.',
  },
  {
    id: 'rri',
    title: 'What is RRI?',
    content: 'The Respiratory Risk Index is AERIS\'s personalized metric. While AQI is generic, RRI applies demographic modifiers (age, conditions, activity) to generate a personal risk score from 0-100.',
  },
  {
    id: 'health',
    title: 'Health Effects',
    content: 'PM2.5 bypasses respiratory defenses and enters the bloodstream. Ozone attacks lung tissue chemically. CO displaces oxygen in red blood cells. Chronic exposure leads to permanent decreased lung capacity.',
  },
  {
    id: 'aeris',
    title: 'How AERIS Works',
    content: 'ESP32 IoT sensors continuously sample local air. Raw telemetry is transmitted to our cloud engine, which cross-references WHO guidelines and user medical profiles to output real-time health intelligence.',
  },
];

const Network = () => {
  const data = useAerisStore((s) => s.data);
  const [expandedId, setExpandedId] = useState(null);

  if (!data?.derived) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <div>
          <div className="h-7 w-48 bg-slate-800/60 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-slate-800/40 rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-8 space-y-5">
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl h-48 animate-pulse" />
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl h-64 animate-pulse" />
          </div>
          <div className="xl:col-span-4 space-y-5">
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl h-48 animate-pulse" />
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl h-64 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const nodes = data.nodes || [];
  const derived = data.derived;
  const isHighRisk = derived?.rri > 75;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Network</h1>
        <p className="text-sm text-slate-500 mt-0.5">IoT fleet status, architecture, and knowledge base.</p>
      </div>

      {/* Alert Banner */}
      <AnimatePresence>
        {isHighRisk && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-400">High Risk Detected</p>
                <p className="text-xs text-slate-400">Sensors indicate elevated pollution levels in monitored sectors.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* Left: Architecture & Nodes */}
        <div className="xl:col-span-8 space-y-5">

          {/* Architecture */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-6">System Architecture</h3>

            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {[
                { icon: Wifi, name: 'ESP32 Sensors', sub: 'Raw capture', color: 'text-sky-400', bg: 'bg-sky-500/10' },
                { icon: Server, name: 'Cloud API', sub: 'Ingestion', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { icon: Database, name: 'Processing', sub: 'AQI/RRI compute', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { icon: Activity, name: 'Dashboard', sub: 'Visualization', color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map((step, i, arr) => (
                <React.Fragment key={step.name}>
                  <div className="flex flex-col items-center bg-slate-900/50 border border-slate-700/40 rounded-xl p-5 w-full md:w-40 text-center">
                    <div className={`w-10 h-10 ${step.bg} rounded-lg flex items-center justify-center mb-3`}>
                      <step.icon size={20} className={step.color} />
                    </div>
                    <span className="text-sm font-semibold text-white">{step.name}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">{step.sub}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden md:block text-slate-600 text-lg">&rarr;</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Nodes Table */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-slate-300">Sensor Nodes</h3>
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                {nodes.filter((n) => n.status === 'active').length} Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-700/40 text-xs text-slate-500">
                    <th className="pb-3 pl-2 font-medium">Node ID</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Location</th>
                    <th className="pb-3 font-medium">Coordinates</th>
                    <th className="pb-3 pr-2 text-right font-medium">Last Sync</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {nodes.map((node, i) => (
                    <tr key={i} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${node.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className="font-mono text-slate-300">{node.id}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${node.status === 'active' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                          {node.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400 truncate max-w-[150px]">{node.location_name || 'Assigned'}</td>
                      <td className="py-3 font-mono text-xs text-slate-500">{node.lat ? `${Number(node.lat).toFixed(3)}, ${Number(node.lng).toFixed(3)}` : '--'}</td>
                      <td className="py-3 pr-2 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-400">
                          <Clock size={12} />
                          <span className="text-xs">{node.lastPing ? new Date(node.lastPing).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: System Health & Knowledge Base */}
        <div className="xl:col-span-4 space-y-5">

          {/* System Health */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">System Health</h3>
            <div className="space-y-3">
              {[
                { label: 'Poll Interval', value: '10s', icon: Clock, color: 'text-sky-400' },
                { label: 'Data Source', value: 'ESP32 Cluster', icon: Database, color: 'text-indigo-400' },
                { label: 'Uptime', value: '99.9%', icon: ShieldCheck, color: 'text-emerald-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <item.icon size={14} className={item.color} />
                    <span className="text-xs text-slate-400">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Knowledge Base</h3>
            <div className="space-y-2">
              {learningData.map((item) => {
                const isOpen = expandedId === item.id;
                return (
                  <div key={item.id} className="bg-slate-900/50 border border-slate-700/30 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isOpen ? null : item.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-800/40 transition-colors"
                    >
                      <span className="text-sm text-slate-300">{item.title}</span>
                      {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-3 pb-3"
                        >
                          <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-700/40 pt-3">
                            {item.content}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Network;
