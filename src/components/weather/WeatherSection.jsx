import { Suspense, lazy } from 'react';
import {
  Thermometer, Droplets, Gauge, Wind, Compass, CloudRain,
  Sun, Eye, ThermometerSun, RefreshCw, CloudSun
} from 'lucide-react';
import useWeatherStore from '@/store/useWeatherStore';
import useWeather from '@/hooks/useWeather';
import WeatherMetricCard from './WeatherMetricCard';
import LocationSelector from './LocationSelector';
import WeatherAlertBanner from './WeatherAlertBanner';
import FiveDayForecast from './FiveDayForecast';
import { getOWMIconUrl, timeAgo } from '@/utils/weatherHelpers';
import {
  getTemperatureColor, getHumidityColor, getPressureColor,
  getWindColor, getUVColor, getVisibilityColor, getRainfallColor,
  degToCompass,
} from '@/utils/weatherHelpers';

const WeatherChart = lazy(() => import('./WeatherChart'));

export default function WeatherSection() {
  const { current, forecast, loading, error, lastFetched } = useWeatherStore();
  const { refresh } = useWeather();

  // Loading skeleton
  if (loading && !current) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-44 subtle-surface rounded-lg animate-pulse" />
          <div className="h-5 w-28 subtle-surface rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state — no data at all
  if (error && !current) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-(--color-text-secondary) opacity-60">Weather Parameters</h2>
          <LocationSelector />
        </div>
        <div className="glass-card rounded-xl border border-(--color-card-border) p-6 text-center">
          <CloudSun size={32} className="text-(--color-text-secondary) opacity-30 mx-auto mb-2" />
          <p className="text-sm text-(--color-text-secondary)">{error}</p>
          <button onClick={refresh} className="mt-3 text-xs text-(--color-accent) hover:underline">Try again</button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const w = current.current;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-(--color-text-secondary) opacity-60">Weather Parameters</h2>
          {w.conditionIcon && (
            <div className="flex items-center gap-1.5">
              <img src={getOWMIconUrl(w.conditionIcon)} alt={w.condition} className="w-7 h-7 -my-1" />
              <span className="text-xs text-(--color-text-secondary) capitalize">{w.description}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LocationSelector />
          {lastFetched && (
            <span className="text-[11px] text-(--color-text-secondary) opacity-50">
              {timeAgo(lastFetched)}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg subtle-surface border border-(--color-card-border) text-(--color-text-secondary) hover:text-(--color-accent) transition-colors disabled:opacity-40"
            title="Refresh weather"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Weather Alerts ──────────────────────────────────── */}
      <WeatherAlertBanner alerts={current.alerts} />

      {/* ── Metric Cards Grid ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3">
        <WeatherMetricCard label="Temperature" value={w.temperature} unit="°C" icon={Thermometer} colorFn={getTemperatureColor} decimals={1} />
        <WeatherMetricCard label="Feels Like" value={w.feelsLike} unit="°C" icon={ThermometerSun} colorFn={getTemperatureColor} decimals={1} />
        <WeatherMetricCard label="Humidity" value={w.humidity} unit="%" icon={Droplets} colorFn={getHumidityColor} />
        <WeatherMetricCard label="Pressure" value={w.pressure} unit="hPa" icon={Gauge} colorFn={getPressureColor} />
        <WeatherMetricCard label="Wind Speed" value={w.windSpeed} unit="km/h" icon={Wind} colorFn={getWindColor} decimals={1} />
        <WeatherMetricCard label="Wind Direction" value={w.windDirection} unit="°" icon={Compass} colorFn={() => '#9FB8C3'} suffix={w.windDirectionLabel} />
        <WeatherMetricCard label="Rainfall" value={w.rainfall} unit="mm" icon={CloudRain} colorFn={getRainfallColor} decimals={1} />
        <WeatherMetricCard label="UV Index" value={w.uvIndex} unit="" icon={Sun} colorFn={getUVColor} decimals={1} />
        <WeatherMetricCard label="Visibility" value={w.visibility} unit="km" icon={Eye} colorFn={getVisibilityColor} decimals={1} />
      </div>

      {/* ── Weather Charts (lazy) ──────────────────────────── */}
      <Suspense fallback={
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-5">
          {[1,2,3].map(i => <div key={i} className="glass-card rounded-xl h-48 animate-pulse" />)}
        </div>
      }>
        <WeatherChart hourlyData={forecast?.hourly} />
      </Suspense>

      {/* ── 5-Day Forecast ─────────────────────────────────── */}
      <FiveDayForecast days={forecast?.daily} />
    </div>
  );
}
