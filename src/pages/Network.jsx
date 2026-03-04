import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Network as NetIcon, Server, Database, Activity, Wifi, ShieldCheck, 
  Cpu, Zap, Clock, ChevronDown, ChevronUp, AlertCircle, RefreshCw 
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';

// Expandable Learning Cards Data
const learningData = [
  {
    id: 'aqi',
    title: 'What is AQI?',
    content: 'The Air Quality Index (AQI) is a global standard for reporting daily air quality. It calculates the concentration of 6 major pollutants (PM2.5, PM10, O3, NO2, CO, VOCs) into a single score from 0-500. It tells you how clean or polluted your air is, and what associated health effects might be a concern.',
  },
  {
    id: 'rri',
    title: 'What is Personal RRI?',
    content: 'The Relative Risk Index (RRI) is AERIS\'s proprietary metric. While AQI is generic, RRI applies demographic modifiers (e.g., asthmatic, elderly) to the baseline AQI to generate a personalized threat score ranging from 0-100. It answers "How dangerous is this air FOR ME right now?"',
  },
  {
    id: 'health',
    title: 'Physiological Effects',
    content: 'PM2.5 particles are small enough to bypass the respiratory system\'s natural defenses, entering the bloodstream and causing cardiovascular stress. Ground-level ozone attacks lung tissue chemically, while CO displaces oxygen in red blood cells. Chronic exposure leads to permanent decreased lung capacity.',
  },
  {
    id: 'aeris',
    title: 'How AERIS Works',
    content: 'A fleet of ESP32 IoT sensors scattered across the city continuously sample local air. This raw telemetry is transmitted via MQTT to our centralized cloud engine, which cross-references WHO guidelines and user medical profiles to output real-time, actionable survival intelligence.',
  }
];

const Network = () => {
  const { data, fetchLatest } = useAerisStore();
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  if (!data?.nodes) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { nodes, derived } = data;
  const isEventActive = derived?.rri > 75; // Trigger banner if RRI is danger

  return (
    <div className="p-8 pb-32 max-w-[1600px] mx-auto space-y-8 text-slate-100 selection:bg-amber-500/30">
      
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <NetIcon size={24} className="text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
            <h1 className="text-3xl font-black tracking-tight">System Network</h1>
          </div>
          <p className="text-slate-400 font-medium">IoT Fleet telemetry, system architecture, and knowledge base.</p>
        </div>
        <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center space-x-2">
           <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#fbbf24]" />
           <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Core Engine Online</span>
        </div>
      </div>

      {/* ── Optional Event Banner ──────────────────────────── */}
      <AnimatePresence>
        {isEventActive && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
          >
             <div className="flex items-center space-x-3">
               <AlertCircle size={20} className="text-red-500 animate-pulse" />
               <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-red-400">Tactical Event Detected</h4>
                  <p className="text-xs text-slate-300">Sensors indicate an ongoing critical pollution spike in Sector 4.</p>
               </div>
             </div>
             <button className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-500 text-xs font-black tracking-widest uppercase border border-red-500/50 transition-colors">
                View Event Data
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* ── Left Column: Architecture & Fleet ────────────── */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* System Architecture Diagram */}
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-[#0B0F1A]/0 to-transparent pointer-events-none" />
             
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-8 flex items-center space-x-2 relative z-10">
               <Cpu size={14} className="text-amber-500" />
               <span>AERIS Architecture Pipeline</span>
             </h3>
             
             {/* Flow Diagram */}
             <div className="flex flex-col md:flex-row items-center justify-between relative z-10 gap-4">
                
                {/* 1. Sensors */}
                <div className="flex flex-col items-center bg-[#0B0F1A] border border-white/5 p-4 rounded-2xl w-full md:w-40 z-10 shadow-lg">
                   <div className="w-12 h-12 bg-sky-500/10 rounded-full flex items-center justify-center mb-3">
                     <Wifi size={24} className="text-sky-400" />
                   </div>
                   <span className="text-xs font-black uppercase tracking-widest text-white">ESP32 Sensors</span>
                   <span className="text-[10px] text-slate-500 mt-1">Raw Telemetry</span>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex flex-col items-center w-8">
                   <div className="w-full h-0.5 bg-gradient-to-r from-sky-400 to-indigo-500 opacity-50 relative">
                     <div className="absolute -right-1 -top-1 w-2.5 h-2.5 border-t-2 border-r-2 border-indigo-500 rotate-45" />
                   </div>
                </div>

                {/* 2. Backend API */}
                <div className="flex flex-col items-center bg-[#0B0F1A] border border-white/5 p-4 rounded-2xl w-full md:w-40 z-10 shadow-lg">
                   <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mb-3">
                     <Server size={24} className="text-indigo-400" />
                   </div>
                   <span className="text-xs font-black uppercase tracking-widest text-white">Cloud API</span>
                   <span className="text-[10px] text-slate-500 mt-1">Data Ingestion</span>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex flex-col items-center w-8">
                   <div className="w-full h-0.5 bg-gradient-to-r from-indigo-500 to-emerald-500 opacity-50 relative">
                     <div className="absolute -right-1 -top-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-500 rotate-45" />
                   </div>
                </div>

                {/* 3. Global Engine */}
                <div className="flex flex-col items-center bg-[#0B0F1A] border border-t-emerald-500/50 p-4 rounded-2xl w-full md:w-40 z-10 shadow-[0_10px_30px_rgba(16,185,129,0.1)]">
                   <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3">
                     <Database size={24} className="text-emerald-400" />
                   </div>
                   <span className="text-xs font-black uppercase tracking-widest text-white">AI Engine</span>
                   <span className="text-[10px] text-emerald-500/60 mt-1 uppercase font-bold tracking-widest">Global State</span>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex flex-col items-center w-8">
                   <div className="w-full h-0.5 bg-gradient-to-r from-emerald-500 to-amber-500 opacity-50 relative">
                     <div className="absolute -right-1 -top-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-500 rotate-45" />
                   </div>
                </div>

                {/* 4. Client UI */}
                <div className="flex flex-col items-center bg-[#0B0F1A] border border-white/5 p-4 rounded-2xl w-full md:w-40 z-10 shadow-lg relative overflow-hidden group">
                   <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors pointer-events-none" />
                   <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-3">
                     <Activity size={24} className="text-amber-400" />
                   </div>
                   <span className="text-xs font-black uppercase tracking-widest text-white">AERIS UI</span>
                   <span className="text-[10px] text-slate-500 mt-1">Client Dashboard</span>
                </div>

             </div>
          </div>

          {/* Sensor Nodes Table */}
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center space-x-2">
                  <NetIcon size={14} className="text-white" />
                  <span>Fleet Diagnostics</span>
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                  {nodes.filter(n => n.status === 'active').length} Active Nodes
                </span>
             </div>

             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-white/10 text-[10px] uppercase font-black tracking-widest text-slate-500">
                     <th className="pb-4 pl-4">Node ID</th>
                     <th className="pb-4">Status</th>
                     <th className="pb-4">Location</th>
                     <th className="pb-4">Coordinates</th>
                     <th className="pb-4 pr-4 text-right">Last Sync</th>
                   </tr>
                 </thead>
                 <tbody className="text-sm border-b border-white/5">
                   {nodes.map((node, i) => (
                     <tr key={i} className="group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                       <td className="py-4 pl-4 flex items-center space-x-3">
                         <div className={`w-2 h-2 rounded-full ${node.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
                         <span className="font-mono text-slate-300 group-hover:text-white font-bold">{node.id}</span>
                       </td>
                       <td className="py-4">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${node.status === 'active' ? 'text-emerald-400 bg-emerald-500/10 cursor-pointer' : 'text-rose-400 bg-rose-500/10'}`}>
                           {node.status}
                         </span>
                       </td>
                       <td className="py-4 text-slate-400 truncate max-w-[150px]">{node.location_name || 'Assigned'}</td>
                       <td className="py-4 font-mono text-xs text-slate-500">[{node.lat}, {node.lng}]</td>
                       <td className="py-4 pr-4 text-right">
                          <div className="flex items-center justify-end space-x-2 text-slate-400">
                            <Clock size={12} />
                            <span className="text-xs font-mono">{node.lastPing || 'Just now'}</span>
                          </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>

        </div>

        {/* ── Right Column: Health & Learning ────────────── */}
        <div className="xl:col-span-4 space-y-8">
          
          {/* System Health / Data Integrity Panel */}
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center space-x-2">
               <ShieldCheck size={14} className="text-emerald-400" />
               <span>Data Integrity Core</span>
             </h3>
             
             <div className="space-y-4">
               {[
                 { label: 'Network Polling', value: '8.0s Interval', icon: RefreshCw, color: 'text-sky-400', bg: 'bg-sky-400/10' },
                 { label: 'Primary Source', value: 'Edge Node Cluster', icon: Database, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
                 { label: 'AI Calibration', value: 'Actively Training', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                 { label: 'Sensor Accuracy', value: '99.98% True', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
               ].map((item, i) => (
                 <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[#0B0F1A] border border-white/5">
                   <div className="flex items-center space-x-4">
                     <div className={`p-2 rounded-lg ${item.bg}`}>
                       <item.icon size={16} className={item.color} />
                     </div>
                     <span className="text-xs font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                   </div>
                   <span className="text-xs font-bold text-white tracking-wide">{item.value}</span>
                 </div>
               ))}
             </div>
          </div>

          {/* Educational / Learn Section */}
          <div className="bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center space-x-2">
               <Database size={14} className="text-white" />
               <span>Knowledge Base</span>
             </h3>
             
             <div className="space-y-3">
               {learningData.map((item) => {
                 const isExpanded = expandedId === item.id;
                 return (
                   <div 
                     key={item.id} 
                     className="bg-[#0B0F1A] border border-white/5 rounded-xl overflow-hidden transition-all duration-300"
                   >
                     <button 
                       onClick={() => setExpandedId(isExpanded ? null : item.id)}
                       className="w-full flex items-center justify-between p-4 focus:outline-hidden group hover:bg-white/5 transition-colors"
                     >
                       <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{item.title}</span>
                       <div className="text-slate-500 group-hover:text-sky-400 transition-colors">
                         {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                       </div>
                     </button>
                     
                     <AnimatePresence>
                       {isExpanded && (
                         <motion.div
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: 'auto', opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           className="px-4 pb-4"
                         >
                           <p className="text-xs text-slate-400 leading-relaxed border-t border-white/10 pt-4">
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
