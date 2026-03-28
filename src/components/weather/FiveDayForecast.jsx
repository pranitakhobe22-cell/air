import { Calendar } from 'lucide-react';
import ForecastRow from './ForecastRow';

export default function FiveDayForecast({ days = [] }) {
  if (!days.length) return null;

  return (
    <div className="glass-card rounded-xl border border-(--color-card-border) p-5 mt-5">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-(--color-accent)" />
        <h3 className="text-xs font-medium text-(--color-text-secondary) opacity-60 uppercase tracking-wider">5-Day Forecast</h3>
      </div>
      <div>
        {days.map((day) => (
          <ForecastRow key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}

