import { Droplets, Wind } from 'lucide-react';
import { getOWMIconUrl, getTemperatureColor } from '@/utils/weatherHelpers';

export default function ForecastRow({ day }) {
  const hiColor = getTemperatureColor(day.tempHigh);
  const loColor = getTemperatureColor(day.tempLow);

  return (
    <div className="flex items-center justify-between py-3 border-b border-(--color-card-border)/30 last:border-0 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs font-semibold text-(--color-text-primary) w-8 shrink-0">{day.dayOfWeek}</span>
        <img src={getOWMIconUrl(day.conditionIcon)} alt={day.condition} className="w-8 h-8 shrink-0" />
        <span className="text-xs text-(--color-text-secondary) truncate hidden sm:block">{day.condition}</span>
      </div>
      <div className="flex items-center gap-4 text-xs shrink-0">
        <div className="flex items-center gap-1">
          <Droplets size={11} className="text-sky-400 opacity-60" />
          <span className="text-(--color-text-secondary) tabular-nums">{day.rainfall}mm</span>
        </div>
        <div className="flex items-center gap-1">
          <Wind size={11} className="text-(--color-text-secondary) opacity-60" />
          <span className="text-(--color-text-secondary) tabular-nums">{day.windSpeed}</span>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          <span className="font-semibold" style={{ color: hiColor }}>{Math.round(day.tempHigh)}°</span>
          <span className="text-(--color-text-secondary) opacity-40">/</span>
          <span className="font-medium" style={{ color: loColor }}>{Math.round(day.tempLow)}°</span>
        </div>
      </div>
    </div>
  );
}
