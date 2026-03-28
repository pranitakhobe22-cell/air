import { useEffect, useRef, useCallback } from 'react';
import useWeatherStore from '@/store/useWeatherStore';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const DEFAULT_LOCATION = { lat: 19.076, lon: 72.877, city: 'Mumbai', source: 'fallback' };

export default function useWeather() {
  const { location, setLocation, fetchAll } = useWeatherStore();
  const initialized = useRef(false);

  // Geolocation on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // If user already has a manual/saved location, just fetch
    if (location.source === 'manual' || location.source === 'fallback') {
      fetchAll();
      return;
    }

    // If we already have coords from a previous auto-detect, fetch directly
    if (location.lat && location.lon && location.source === 'auto') {
      fetchAll();
      return;
    }

    // Try browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, city: null, source: 'auto' });
          setTimeout(() => useWeatherStore.getState().fetchAll(), 50);
        },
        () => {
          // Denied or unavailable — fallback
          setLocation(DEFAULT_LOCATION);
          setTimeout(() => useWeatherStore.getState().fetchAll(), 50);
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    } else {
      setLocation(DEFAULT_LOCATION);
      fetchAll();
    }
  }, []);

  // Refresh interval
  useEffect(() => {
    const id = setInterval(() => useWeatherStore.getState().fetchAll(), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(() => {
    useWeatherStore.getState().fetchAll();
  }, []);

  return { refresh };
}
