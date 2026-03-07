import React from 'react';
import {
  Wind, TrendingUp, TrendingDown, Minus, Activity, Thermometer, Droplets, Gauge
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, Tooltip
} from 'recharts';
import useAerisStore from '@/store/aerisStore';
import useActiveNode from '@/hooks/useActiveNode';

const POLLUTANTS = {
  pm25: {
    label: 'PM2.5', unit: 'µg/m³', safe: 12, moderate: 35, danger: 55,
    color: '#38bdf8',
    desc: 'Fine particulate matter that penetrates deep into lung tissue.',
    impact: 'Cardiovascular stress and respiratory irritation.',
  },
  pm10: {
    label: 'PM10', unit: 'µg/m³', safe: 54, moderate: 154, danger: 254,
    color: '#818cf8',
    desc: 'Coarse particles from construction and road dust.',
    impact: 'Upper respiratory inflammation; aggravates asthma.',
  },
  o3: {
    label: 'Ozone (O3)', unit: 'ppb', safe: 54, moderate: 70, danger: 85,
    color: '#34d399',
    desc: 'Ground-level gas formed by sunlight and emissions.',
    impact: 'Damages lung tissue and reduces pulmonary function.',
  },
  no2: {
    label: 'NO2', unit: 'ppb', safe: 53, moderate: 100, danger: 360,
    color: '#fbbf24',
    desc: 'Reactive gas primarily from vehicle exhaust.',
    impact: 'Increases susceptibility to respiratory infections.',
  },
  co: {
    label: 'CO', unit: 'ppm', safe: 4.4, moderate: 9.4, danger: 12.4,
    color: '#f472b6',
    desc: 'Odorless toxic gas from incomplete combustion.',
    impact: 'Reduces oxygen delivery to organs and tissues.',
  },
  voc: {
    label: 'VOC Index', unit: 'index', safe: 100, moderate: 250, danger: 400,
    color: '#a78bfa',
    desc: 'Volatile organic compound index from metal-oxide sensor (1-500 scale).',
    impact: 'Eye/nose irritation; prolonged exposure may be carcinogenic.',
  },
};

const ChartTooltip = ({ active, payload }) => {
  if (active && payload?.[0]) {
    return (
      <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
        <span className="font-semibold" style={{ color: payload[0].stroke }}>
          {Number(payload[0].value).toFixed(1)}
        </span>
      </div>
    );
  }
  return null;
};

const Pollutants = () => {
  const data = useAerisStore((s) => s.data);
  const active = useActiveNode();

  if (!active.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { sensors, environment, derived, history } = active;
  const historyData = Array.isArray(history) ? history.slice(-20) : [];

  const getTrend = (key, val) => {
    if (historyData.length < 2) return <Minus size={14} className="text-slate-500" />;
    const prev = historyData[historyData.length - 2]?.[key] || val;
    if (val > prev * 1.05) return <TrendingUp size={14} className="text-rose-400" />;
    if (val < prev * 0.95) return <TrendingDown size={14} className="text-emerald-400" />;
    return <Minus size={14} className="text-slate-500" />;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Pollutant Analysis</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {active.isNodeView ? `${active.nodeName} — ` : ''}Individual pollutant readings, thresholds, and health impacts.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* Pollutant Cards */}
        <div className="xl:col-span-9 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(POLLUTANTS).map(([key, config]) => {
            const sensorKey = key === 'no2' ? 'nox' : key === 'voc' ? 'voc_index' : key;
            const histKey = key === 'no2' ? 'nox' : key === 'voc' ? 'voc_index' : key;
            const value = sensors?.[sensorKey] || 0;
            const fill = Math.min((value / config.danger) * 100, 100);
            const isDanger = value >= config.danger;
            const isWarning = value >= config.moderate && !isDanger;
            const statusColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#22c55e';
            const statusLabel = isDanger ? 'Dangerous' : isWarning ? 'Elevated' : 'Safe';

            const sparkData = historyData.map((h) => ({
              value: h[histKey] || 0,
            }));

            return (
              <div
                key={key}
                className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 flex flex-col"
              >
                {/* Top */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">{config.label}</span>
                  {getTrend(histKey, value)}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${statusColor}15`, color: statusColor }}>
                    {statusLabel}
                  </span>
                </div>

                {/* Value */}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-white tabular-nums">{Number(value).toFixed(1)}</span>
                  <span className="text-xs text-slate-500">{config.unit}</span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${fill}%`, backgroundColor: statusColor }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 mb-4">
                  <span>0</span>
                  <span>Safe {config.safe}</span>
                  <span>Danger {config.danger}</span>
                </div>

                {/* Sparkline */}
                {sparkData.length > 0 && (
                  <div className="h-12 -mx-1 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData}>
                        <defs>
                          <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={config.color} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />
                        <Area type="linear" dataKey="value" stroke={config.color} strokeWidth={1.5} fill={`url(#grad-${key})`} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Description */}
                <div className="mt-auto pt-3 border-t border-slate-700/40 space-y-1.5">
                  <p className="text-xs text-slate-400 leading-relaxed">{config.desc}</p>
                  <p className="text-xs font-medium" style={{ color: config.color }}>{config.impact}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Environment */}
        <div className="xl:col-span-3">
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 space-y-4 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Environment</h3>

            {[
              { label: 'Temperature', value: `${Number(environment?.temperature || 0).toFixed(1)} °C`, icon: Thermometer, color: 'text-rose-400' },
              { label: 'Humidity', value: `${Number(environment?.humidity || 0).toFixed(1)}%`, icon: Droplets, color: 'text-blue-400' },
              { label: 'Pressure', value: `${Math.floor(environment?.pressure || 0)} hPa`, icon: Gauge, color: 'text-indigo-400' },
              { label: 'Oxygen', value: `${Number(environment?.oxygen || 0).toFixed(1)}%`, icon: Wind, color: 'text-emerald-400' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <item.icon size={16} className={item.color} />
                  <span className="text-xs text-slate-400">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-white">{item.value}</span>
              </div>
            ))}

            <div className="flex items-center gap-2 pt-3 border-t border-slate-700/40">
              <Activity size={12} className="text-emerald-400" />
              <span className="text-[11px] text-slate-500">Sensors synced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pollutants;
