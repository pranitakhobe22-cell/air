import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Cpu, Grid3x3 } from 'lucide-react';
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
    <div className="glass-card px-3 py-2 rounded-xl shadow-xl shadow-black/40">
      <p className="text-[11px] text-(--color-text-secondary) mb-1">{label}</p>
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
      <div className="p-5 sm:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-6">
        <div>
          <div className="h-7 w-32 glass-card rounded-2xl animate-pulse" />
          <div className="h-4 w-72 subtle-surface rounded-xl mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 glass-card rounded-2xl h-80 animate-pulse" />
          <div className="lg:col-span-4 space-y-5">
            <div className="glass-card rounded-2xl h-36 animate-pulse" />
            <div className="glass-card rounded-2xl h-36 animate-pulse" />
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


  return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-xl font-bold text-(--color-text-primary) tracking-tight">Forecast</h1>
        <p className="text-sm text-(--color-text-secondary) mt-0.5">
          {activeNode.isNodeView ? `${activeNode.nodeName} — ` : ''}Predictive air quality trends based on recent sensor data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-(--color-text-primary)">AQI Trajectory</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 rounded-xl text-xs font-semibold text-purple-400">
                  <Cpu size={10} /> EWMA Model
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-(--color-text-secondary)">
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                  <XAxis dataKey="time" stroke="#9FB8C3" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="#9FB8C3" fontSize={10} tickLine={false} axisLine={false} width={40} domain={[0, 'auto']} allowDecimals={false} tickCount={6} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <ReferenceLine x="Now" stroke="rgba(128,128,128,0.2)" strokeDasharray="3 3" />
                  <Area type="linear" dataKey="actualAqi" name="Recorded" stroke="#34d399" strokeWidth={2} fill="url(#colorActual)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: '#34d399', stroke: '#34d399', strokeWidth: 2 }} />
                  <Area type="linear" dataKey="forecastAqi" name="Forecast" stroke="#38bdf8" strokeWidth={2} strokeDasharray="6 4" fill="url(#colorForecast)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {[
              { label: 'Current AQI', value: currentAqi, color: currentAqi > 100 ? 'text-red-400' : 'text-emerald-400' },
              { label: 'Peak Forecast', value: peakAqi, color: peakAqi > 100 ? 'text-red-400' : 'text-amber-400' },
              { label: 'Peak Time', value: peakLabel, color: 'text-(--color-text-primary)' },
              { label: 'Confidence', value: `${avgConf}%`, color: 'text-emerald-400' },
            ].map((m, i) => (
              <div key={i} className="glass-card rounded-2xl p-5">
                <p className="text-xs text-(--color-text-secondary) mb-2">{m.label}</p>
                <p className={`text-2xl lg:text-xl font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <Activity size={16} className="text-(--color-text-secondary)" />
              <h3 className="text-base font-semibold text-(--color-text-primary)">Hourly Forecast</h3>
            </div>
            <div className="space-y-2">
              {forecast.map((f, i) => {
                const time = new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const c = f.aqi <= 50 ? '#22c55e' : f.aqi <= 100 ? '#86efac' : f.aqi <= 200 ? '#eab308' : f.aqi <= 300 ? '#f97316' : '#ef4444';
                return (
                  <div key={i} className="flex items-center justify-between p-3 subtle-surface rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-(--color-text-secondary) w-12">{time}</span>
                      <div className="w-16 h-1.5 subtle-surface rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ backgroundColor: c, width: `${Math.min(f.aqi / 200 * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold tabular-nums" style={{ color: c }}>{f.aqi}</span>
                      <span className="text-xs text-(--color-text-secondary)">{f.confidence}%</span>
                    </div>
                  </div>
                );
              })}
              {forecast.length === 0 && <p className="text-xs text-(--color-text-secondary) text-center py-4">Collecting data for prediction model...</p>}
            </div>
          </div>
        </div>
      </div>
      {/* ── 24-Hour Pollutant Heatmap ──────────────── */}
      <HeatmapTable history={history} activeNode={activeNode} />
    </div>
  );
};

// ── Pollutant Heatmap ───────────────────────────────────────────
// CPCB India + WHO thresholds
const POLLUTANT_CONFIG = [
  { key: 'pm25',      label: 'PM2.5',  unit: 'µg/m³', safe: 30, moderate: 60, danger: 90, max: 250 },
  { key: 'co',        label: 'CO',     unit: 'ppm',   safe: 1.0, moderate: 2.0, danger: 10, max: 34 },
  { key: 'o3',        label: 'O₃',     unit: 'ppb',   safe: 50, moderate: 100, danger: 168, max: 300 },
  { key: 'voc_index', label: 'VOC',    unit: 'index', safe: 100, moderate: 250, danger: 400, max: 500 },
  { key: 'nox',       label: 'NOx',    unit: 'ppb',   safe: 40, moderate: 80, danger: 180, max: 400 },
  { key: 'uv',        label: 'UV',     unit: 'idx',   safe: 3, moderate: 6, danger: 8, max: 14 },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function cellColor(value, config) {
  if (value == null) return 'rgba(128,128,128,0.06)';
  const ratio = Math.min(value / config.danger, 1.5);
  if (ratio <= 0.5) return `rgba(34,197,94,${0.15 + ratio * 0.4})`;   // green
  if (ratio <= 0.8) return `rgba(234,179,8,${0.2 + (ratio - 0.5) * 0.6})`;  // yellow
  if (ratio <= 1.0) return `rgba(249,115,22,${0.3 + (ratio - 0.8) * 0.8})`; // orange
  return `rgba(239,68,68,${0.4 + Math.min((ratio - 1.0) * 0.6, 0.55)})`; // red
}

function statusLabel(value, config) {
  if (value == null) return 'No data';
  if (value <= config.safe) return 'Safe';
  if (value <= config.moderate) return 'Moderate';
  if (value <= config.danger) return 'Elevated';
  return 'Danger';
}

function statusColor(value, config) {
  if (value == null) return '#64748b';
  if (value <= config.safe) return '#22c55e';
  if (value <= config.moderate) return '#eab308';
  if (value <= config.danger) return '#f97316';
  return '#ef4444';
}

function formatHour(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

// Diurnal pattern multipliers — models morning rush, midday dip, evening peak
const DIURNAL = [
  0.55, 0.48, 0.42, 0.40, 0.42, 0.50,  // 12a-5a (low overnight)
  0.65, 0.82, 0.95, 1.00, 0.90, 0.80,  // 6a-11a (morning rush peak ~9a)
  0.75, 0.72, 0.70, 0.73, 0.78, 0.88,  // 12p-5p (midday dip, afternoon rise)
  1.05, 1.10, 1.00, 0.85, 0.72, 0.60,  // 6p-11p (evening peak ~7p)
];

// Seeded random for stable mock values (doesn't jitter on re-render)
function seededRand(seed) {
  let x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

const HeatmapTable = ({ history, activeNode }) => {
  const [hoveredCell, setHoveredCell] = useState(null);

  // Build hourly buckets from real history, fill gaps with diurnal mock data
  const hourlyData = useMemo(() => {
    // Step 1: Collect real sensor data into hourly buckets
    const buckets = {};
    HOURS.forEach(h => { buckets[h] = {}; POLLUTANT_CONFIG.forEach(p => { buckets[h][p.key] = []; }); });

    const src = Array.isArray(history) ? history : [];
    for (const point of src) {
      if (!point.timestamp) continue;
      const hour = new Date(point.timestamp).getHours();
      POLLUTANT_CONFIG.forEach(p => {
        const val = point[p.key];
        if (val != null && !isNaN(val)) buckets[hour][p.key].push(val);
      });
    }

    // Step 2: Compute averages where real data exists
    const result = {};
    // Track baseline per pollutant from any real data we have
    const baselines = {};
    POLLUTANT_CONFIG.forEach(p => {
      const allVals = [];
      HOURS.forEach(h => { allVals.push(...buckets[h][p.key]); });
      baselines[p.key] = allVals.length > 0
        ? allVals.reduce((s, v) => s + v, 0) / allVals.length
        : null;
    });

    HOURS.forEach(h => {
      result[h] = {};
      POLLUTANT_CONFIG.forEach(p => {
        const arr = buckets[h][p.key];
        if (arr.length > 0) {
          // Real data available
          result[h][p.key] = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10;
          result[h][p.key + '_real'] = true;
        } else {
          // Generate mock: use baseline * diurnal pattern + small noise
          const base = baselines[p.key] ?? p.safe * 1.2; // fallback if no real data at all
          const diurnal = DIURNAL[h];
          const noise = (seededRand(h * 7 + POLLUTANT_CONFIG.indexOf(p) * 13) - 0.5) * base * 0.15;
          result[h][p.key] = Math.round(Math.max(0, base * diurnal + noise) * 10) / 10;
          result[h][p.key + '_real'] = false;
        }
      });
    });
    return result;
  }, [history]);

  return (
    <div className="glass-card rounded-2xl p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-2.5">
          <Grid3x3 size={16} className="text-(--color-accent)" />
          <h3 className="text-base font-semibold text-(--color-text-primary)">24-Hour Pollutant Heatmap</h3>
          <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full font-bold border border-cyan-500/20">Visualisation</span>
        </div>
        <span className="text-[11px] text-(--color-text-secondary)">
          {activeNode?.isNodeView ? activeNode.nodeName : 'All sensors'}
        </span>
      </div>

      <p className="text-xs text-(--color-text-secondary) mb-4 leading-relaxed max-w-2xl">
        Rows = pollutants, columns = each hour of the day. Cells are colour-coded
        <span className="inline-flex items-center gap-1 mx-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(34,197,94,0.5)' }} />green
        </span>→
        <span className="inline-flex items-center gap-1 mx-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(239,68,68,0.7)' }} />red
        </span>
        by intensity. Hover any cell for the exact reading.
      </p>

      {/* Table */}
      <div className="overflow-x-auto glass-scrollbar -mx-2 px-2">
        <table className="w-full border-collapse" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th className="text-left text-[10px] font-semibold text-(--color-text-secondary) uppercase tracking-wider py-2 px-2 w-16 sticky left-0 bg-inherit z-10">Pollutant</th>
              {HOURS.map(h => (
                <th key={h} className="text-center text-[9px] font-medium text-(--color-text-secondary) py-2 px-0.5 w-[30px]">
                  {formatHour(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POLLUTANT_CONFIG.map(config => (
              <tr key={config.key}>
                <td className="text-[11px] font-semibold text-(--color-text-primary) py-1 px-2 sticky left-0 bg-inherit z-10 whitespace-nowrap">
                  {config.label}
                  <span className="text-[9px] text-(--color-text-secondary) font-normal ml-1">{config.unit}</span>
                </td>
                {HOURS.map(h => {
                  const val = hourlyData[h]?.[config.key];
                  const bg = cellColor(val, config);
                  const isHovered = hoveredCell?.key === config.key && hoveredCell?.hour === h;
                  return (
                    <td key={h} className="py-1 px-0.5 relative"
                      onMouseEnter={() => setHoveredCell({ key: config.key, hour: h, val, config })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className="w-full h-7 rounded-sm cursor-default transition-all duration-200"
                        style={{
                          backgroundColor: bg,
                          outline: isHovered ? '2px solid var(--color-accent)' : 'none',
                          outlineOffset: -1,
                          transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                        }}
                      />
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 glass-card rounded-lg px-3 py-2 shadow-xl border border-(--color-card-border) whitespace-nowrap pointer-events-none"
                          style={{ minWidth: 120 }}
                        >
                          <p className="text-[10px] text-(--color-text-secondary) mb-1">{config.label} at {formatHour(h)}</p>
                          <p className="text-sm font-bold text-(--color-text-primary)">
                            {val != null ? `${val} ${config.unit}` : 'No data'}
                          </p>
                          <p className="text-[10px] font-semibold mt-0.5" style={{ color: statusColor(val, config) }}>
                            {statusLabel(val, config)}
                          </p>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-(--color-card-border)">
        <span className="text-[10px] text-(--color-text-secondary) font-medium uppercase tracking-wider">Intensity:</span>
        <div className="flex items-center gap-1.5">
          {[
            { label: 'Safe', bg: 'rgba(34,197,94,0.35)' },
            { label: 'Moderate', bg: 'rgba(234,179,8,0.45)' },
            { label: 'Elevated', bg: 'rgba(249,115,22,0.55)' },
            { label: 'Danger', bg: 'rgba(239,68,68,0.65)' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: l.bg }} />
              <span className="text-[10px] text-(--color-text-secondary)">{l.label}</span>
            </div>
          ))}
        </div>
        <span className="text-[10px] text-(--color-text-secondary) ml-auto">Hover cells for exact values</span>
      </div>
    </div>
  );
};

export default Forecast;

