import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-(--color-bg-main) border border-(--color-card-border) rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[11px] text-(--color-text-secondary) mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

function MiniChart({ data, dataKey, name, color, unit }) {
  return (
    <div className="glass-card rounded-xl border border-(--color-card-border) p-5">
      <h4 className="text-[11px] font-medium text-(--color-text-secondary) opacity-60 uppercase tracking-wider mb-3">{name}</h4>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`wg-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
            <XAxis dataKey="time" stroke="#9FB8C3" opacity={0.5} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#9FB8C3" opacity={0.5} fontSize={10} tickLine={false} axisLine={false} width={35} domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey={dataKey} name={`${name} (${unit})`} stroke={color} strokeWidth={2} fill={`url(#wg-${dataKey})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function WeatherChart({ hourlyData = [] }) {
  if (hourlyData.length < 2) return null;

  const chartData = hourlyData.map(h => ({
    time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temperature: h.temperature,
    humidity: h.humidity,
    pressure: h.pressure,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-5">
      <MiniChart data={chartData} dataKey="temperature" name="Temperature" color="#f97316" unit="°C" />
      <MiniChart data={chartData} dataKey="humidity" name="Humidity" color="#3b82f6" unit="%" />
      <MiniChart data={chartData} dataKey="pressure" name="Pressure" color="#a855f7" unit="hPa" />
    </div>
  );
}
