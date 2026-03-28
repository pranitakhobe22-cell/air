import { useState, useEffect, useRef } from 'react';

const AnimatedNum = ({ value, decimals = 0 }) => {
  const [display, setDisplay] = useState(value || 0);
  const prev = useRef(value || 0);
  useEffect(() => {
    if (value == null) return;
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    let start = null, raf;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 500, 1);
      setDisplay(from + (value - from) * p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{(display ?? 0).toFixed(decimals)}</>;
};

export default function WeatherMetricCard({ label, value, unit, icon: Icon, colorFn, decimals = 0, suffix }) {
  const color = colorFn ? colorFn(value) : '#9FB8C3';
  const displayVal = value != null ? value : '--';

  return (
    <div className="glass-card rounded-xl border border-(--color-card-border) p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={13} style={{ color }} />
        </div>
        <span className="text-[11px] font-medium text-(--color-text-secondary)">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-(--color-text-primary) tabular-nums" style={{ color }}>
          {value != null ? <AnimatedNum value={value} decimals={decimals} /> : '--'}
        </span>
        <span className="text-[11px] text-(--color-text-secondary) opacity-60">{unit}</span>
        {suffix && <span className="text-xs font-medium text-(--color-text-secondary) ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
