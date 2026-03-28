import { useState } from 'react';
import { MapPin, Search, LocateFixed, X } from 'lucide-react';
import useWeatherStore from '@/store/useWeatherStore';

export default function LocationSelector() {
  const { location, setManualCity, useAutoLocation } = useWeatherStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setManualCity(input.trim());
    setInput('');
    setOpen(false);
  };

  const handleAuto = () => {
    useAutoLocation();
    setOpen(false);
    // Re-trigger geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const store = useWeatherStore.getState();
          store.setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, city: null, source: 'auto' });
          setTimeout(() => store.fetchAll(), 50);
        },
        () => {
          const store = useWeatherStore.getState();
          store.setLocation({ lat: 19.076, lon: 72.877, city: 'Mumbai', source: 'fallback' });
          setTimeout(() => store.fetchAll(), 50);
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  };

  const displayCity = location.city || 'Detecting...';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-(--color-text-secondary) hover:text-(--color-text-primary) subtle-surface border border-(--color-card-border) transition-all"
      >
        <MapPin size={12} className="text-(--color-accent)" />
        <span className="max-w-[120px] truncate">{displayCity}</span>
        {location.source === 'fallback' && <span className="text-amber-400 text-[9px]">(default)</span>}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 w-64 glass-card rounded-xl border border-(--color-card-border) p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-(--color-text-primary)">Change Location</span>
            <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-white/10 text-(--color-text-secondary)">
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-(--color-text-secondary) opacity-50" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter city name..."
                className="w-full bg-(--color-bg-main)/80 border border-(--color-card-border) rounded-lg pl-7 pr-3 py-2 text-xs text-(--color-text-primary) placeholder:text-(--color-text-secondary)/40 focus:outline-none focus:ring-1 focus:ring-(--color-accent)/40"
                autoFocus
              />
            </div>
            <button type="submit" className="px-3 py-2 bg-(--color-accent)/20 text-(--color-accent) rounded-lg text-xs font-medium hover:bg-(--color-accent)/30 transition-colors">
              Go
            </button>
          </form>
          <button
            onClick={handleAuto}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/5 transition-colors"
          >
            <LocateFixed size={13} className="text-(--color-accent)" />
            Use my location
          </button>
        </div>
      )}
    </div>
  );
}

