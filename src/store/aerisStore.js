import { create } from 'zustand';
import aerisApi from '../services/aerisApi';

/**
 * AERIS – Global Data Store (Frontend v2)
 * ────────────────────────────────────────────────────────────────
 * Syncs with the Backend API and manages application life-cycle.
 */

const useAerisStore = create((set, get) => ({
  // AERIS_DATA structure
  data: null,
  loading: true,
  error: null,

  /**
   * Fetch initial data snapshot from the REST API.
   * Real-time updates then overlay via WebSocket / Simulator.
   */
  fetchLatest: async () => {
    try {
      set({ loading: true, error: null });
      const response = await aerisApi.get('/latest');
      if (response.data) {
        set({ data: response.data, loading: false, error: null });
      }
    } catch (err) {
      console.warn('[Store] Initial fetch failed, waiting for WebSocket:', err.message);
      set({ loading: false, error: err.message });
    }
  },

  /**
   * Update user profile settings.
   */
  updateProfile: async (profileData) => {
    try {
      const response = await aerisApi.put('/profile', profileData);
      return response.data;
    } catch (err) {
      console.error('❌ [Store] Profile update failed:', err.message);
      throw err;
    }
  },

  /**
   * Called by the Firebase RTDB listener with live ESP32 payload.
   * Merges real sensor data directly into the store, overriding mock values.
   */
  updateFromFirebase: (payload) => {
    if (!payload) return;
    set((state) => {
      // Build base data if store is still null (app just loaded)
      const base = state.data || {
        meta: { location: 'ESP32 Device', timestamp: Date.now() },
        trend: 'stable',
        alerts: [],
        sectors: [],
        nodes: [],
        history: [],
        forecast: [],
      };

      const aqi = payload.aqi || 0;

      const newHistoryPoint = {
        timestamp: Date.now(),
        aqi,
        rri: payload.rri ?? Math.round(aqi * 0.6),
        pm25: payload.pm25 || 0,
        pm10: Math.round((payload.pm25 || 0) * 1.6),
        co: payload.co || 0,
        o3: payload.o3 || 0,
        nox: payload.no2_ppb || 0,
        voc_index: payload.voc || 0,
        temperature: payload.temp || 0,
        humidity: payload.hum || 0,
      };

      const updatedHistory = [...(base.history || []), newHistoryPoint].slice(-60); // Keep last 60 readings

      return {
        data: {
          ...base,
          meta: {
            ...base.meta,
            timestamp: Date.now(),
          },
          sensors: {
            pm25: payload.pm25 || 0,
            pm10: Math.round((payload.pm25 || 0) * 1.6),
            co: payload.co || 0,
            nox: payload.no2_ppb || 0,
            o3: payload.o3 || 0,
            voc_index: payload.voc || 0,
          },
          environment: {
            temperature: payload.temp || 0,
            humidity: payload.hum || 0,
            oxygen: payload.oxygen ?? 21.0,
            pressure: payload.pressure ?? 1013,
          },
          derived: {
            aqi,
            aqi_pm: payload.aqi_pm || 0,
            aqi_o3: payload.aqi_o3 || 0,
            aqi_co: payload.aqi_co || 0,
            aqi_no2: payload.aqi_no2 || 0,
            rri: payload.rri ?? Math.round(aqi * 0.6),
            risk_color: payload.color || '#10b981',
            risk_level: payload.riskLevel || 'Low',
            dominant: 'PM2.5',
            aqi_category: payload.label || 'GOOD',
            air_quality_text: `AQI ${aqi} — ${payload.label || 'Good'}. CO: ${payload.co?.toFixed(1)} ppm, PM2.5: ${payload.pm25?.toFixed(1)} µg/m³.`,
          },
          history: updatedHistory,
        },
        loading: false,
      };
    });
    if (import.meta.env.DEV) {
      console.log('🔥 [Firebase] Live data applied to store:', payload);
    }
  },

}));

export default useAerisStore;
