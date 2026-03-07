import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, CalendarDays, Cpu } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import useAerisStore from '@/store/aerisStore';
import useActiveNode from '@/hooks/useActiveNode';
import { forecastAqi } from '@/utils/aqiEngine';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const valid = payload.filter((p) => p.value != null && !isNaN(p.value));
  if (valid.length === 0) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg">
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      {valid.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name}: {Math.round(p.value)}
        </p>
      ))}
    </div>
  );
};

const Forecast = () => {
  const data = useAerisStore((s) => s.data);
  const activeNode = useActiveNode();

  const history = Array.isArray(activeNode.history) ? activeNode.history : (Array.isArray(data?.history) ? data.history : []);
  const derivedAqi = activeNode.ready ? activeNode.derived?.aqi : data?.derived?.aqi;

  // Use backend forecast if available, otherwise generate client-side EWMA prediction
  const forecast = useMemo(() => {
    const backendForecast = Array.isArray(data?.forecast) ? data.forecast : [];
    if (backendForecast.length > 0) return backendForecast;
    // Client-side Holt's exponential smoothing forecast
    return forecastAqi(history, 6);
  }, [data?.forecast, history]);

  const chartData = useMemo(() => {
    if (!derivedAqi && derivedAqi !== 0) return [];
    const pts = history.slice(-20).map(h => ({
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actualAqi: h.aqi || 0,
    }));
    pts.push({
      time: 'Now',
      actualAqi: derivedAqi || 0,
      forecastAqi: derivedAqi || 0,
    });
    forecast.forEach(f => {
      pts.push({
        time: new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        forecastAqi: f.aqi || 0,
      });
    });
    return pts;
  }, [history, forecast, derivedAqi]);

  if (!data?.derived) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
        <div>
          <div className="h-7 w-32 bg-slate-800/60 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-slate-800/40 rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bg-slate-800/40 border border-slate-700/40 rounded-xl h-80 animate-pulse" />
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl h-36 animate-pulse" />
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl h-36 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const currentAqi = derivedAqi || 0;
  const peakAqi = forecast.length > 0 ? Math.max(...forecast.map(f => f.aqi || 0)) : currentAqi;
  const peakTime = forecast.find(f => f.aqi === peakAqi)?.timestamp;
  const peakLabel = peakTime ? new Date(peakTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';
  const avgConf = forecast.length > 0
    ? Math.round(forecast.reduce((a, f) => a + (f.confidence || 80), 0) / forecast.length) : 80;

  const allAqi = [...history.map(h => h.aqi || 0), currentAqi];
  const total = allAqi.length || 1;
  const safePct = Math.round(allAqi.filter(a => a <= 50).length / total * 100);
  const elevPct = Math.round(allAqi.filter(a => a > 50 && a <= 150).length / total * 100);
  const dangPct = Math.round(allAqi.filter(a => a > 150).length / total * 100);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Forecast</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {activeNode.isNodeView ? `${activeNode.nodeName} — ` : ''}Predictive air quality trends based on recent sensor data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-300">AQI Trajectory</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] font-semibold text-purple-400">
                  <Cpu size={10} /> EWMA Model
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded bg-emerald-400 inline-block" /> Recorded</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded bg-sky-400 inline-block" /> Forecast</span>
              </div>
            </div>
            <div className="h-[240px] sm:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} width={40} domain={[0, 'auto']} allowDecimals={false} tickCount={6} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <ReferenceLine x="Now" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                  <Area type="linear" dataKey="actualAqi" name="Recorded" stroke="#34d399" strokeWidth={2} fill="url(#colorActual)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: '#34d399', stroke: '#0f172a', strokeWidth: 2 }} />
                  <Area type="linear" dataKey="forecastAqi" name="Forecast" stroke="#38bdf8" strokeWidth={2} strokeDasharray="6 4" fill="url(#colorForecast)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {[
              { label: 'Current AQI', value: currentAqi, color: currentAqi > 100 ? 'text-red-400' : 'text-emerald-400' },
              { label: 'Peak Forecast', value: peakAqi, color: peakAqi > 100 ? 'text-red-400' : 'text-amber-400' },
              { label: 'Peak Time', value: peakLabel, color: 'text-white' },
              { label: 'Confidence', value: `${avgConf}%`, color: 'text-emerald-400' },
            ].map((m, i) => (
              <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
                <p className="text-xs text-slate-500 mb-2">{m.label}</p>
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <CalendarDays size={16} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-300">Risk Distribution</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">Based on {total} recent readings</p>
            <div className="space-y-4">
              {[
                { label: 'Safe (0-50)', percent: safePct, color: '#22c55e' },
                { label: 'Elevated (51-150)', percent: elevPct, color: '#eab308' },
                { label: 'Dangerous (151+)', percent: dangPct, color: '#ef4444' },
              ].map((w) => (
                <div key={w.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-slate-400">{w.label}</span>
                    <span className="text-xs font-semibold" style={{ color: w.color }}>{w.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${w.percent}%` }} transition={{ duration: 1 }} className="h-full rounded-full" style={{ backgroundColor: w.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <Activity size={16} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-300">Hourly Forecast</h3>
            </div>
            <div className="space-y-2">
              {forecast.map((f, i) => {
                const time = new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const c = f.aqi <= 50 ? '#22c55e' : f.aqi <= 100 ? '#eab308' : f.aqi <= 150 ? '#f97316' : '#ef4444';
                return (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-12">{time}</span>
                      <div className="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ backgroundColor: c, width: `${Math.min(f.aqi / 200 * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold tabular-nums" style={{ color: c }}>{f.aqi}</span>
                      <span className="text-[10px] text-slate-600">{f.confidence}%</span>
                    </div>
                  </div>
                );
              })}
              {forecast.length === 0 && <p className="text-xs text-slate-600 text-center py-4">Collecting data for prediction model...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Forecast;
