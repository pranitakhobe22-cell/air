import { create } from 'zustand';
import axios from 'axios';

const STORAGE_KEY = 'aeris_weather_location';

// Weather API uses the local backend directly (not the deployed Render backend)
const weatherApi = axios.create({
  baseURL: import.meta.env.VITE_WEATHER_URL || 'http://localhost:3000/api/v1',
  timeout: 25000,
});

function loadLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { lat: null, lon: null, city: null, source: 'auto' };
}

function saveLocation(loc) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch { /* ignore */ }
}

const useWeatherStore = create((set, get) => ({
  current: null,
  forecast: null,
  location: loadLocation(),
  loading: false,
  error: null,
  lastFetched: null,

  setLocation: (loc) => {
    const next = { ...get().location, ...loc };
    saveLocation(next);
    set({ location: next });
  },

  fetchCurrent: async () => {
    const { location } = get();
    const params = location.city
      ? { city: location.city }
      : { lat: location.lat, lon: location.lon };
    if (!params.city && !params.lat) return;

    try {
      const { data } = await weatherApi.get('/weather/current', { params });
      if (data.success) {
        set({ current: data.data, error: null, lastFetched: data.data.fetchedAt });
        // Sync resolved location back
        if (data.data.location) {
          const loc = get().location;
          const updated = { ...loc, lat: data.data.location.lat, lon: data.data.location.lon, city: data.data.location.city };
          saveLocation(updated);
          set({ location: updated });
        }
      }
    } catch (err) {
      set({ error: err.response?.data?.message || err.message });
    }
  },

  fetchForecast: async () => {
    const { location } = get();
    const params = location.city
      ? { city: location.city }
      : { lat: location.lat, lon: location.lon };
    if (!params.city && !params.lat) return;

    try {
      const { data } = await weatherApi.get('/weather/forecast', { params });
      if (data.success) set({ forecast: data.data });
    } catch { /* forecast errors are non-critical */ }
  },

  fetchAll: async () => {
    set({ loading: true, error: null });
    await Promise.all([get().fetchCurrent(), get().fetchForecast()]);
    set({ loading: false });
  },

  setManualCity: (city) => {
    const loc = { lat: null, lon: null, city, source: 'manual' };
    saveLocation(loc);
    set({ location: loc });
    get().fetchAll();
  },

  useAutoLocation: () => {
    set({ location: { lat: null, lon: null, city: null, source: 'auto' } });
    // The useWeather hook will re-trigger geolocation
  },
}));

export default useWeatherStore;
