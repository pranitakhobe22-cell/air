import { create } from 'zustand';
import aerisApi from '../services/aerisApi';
import { computeAqi, detectTrend, forecastAqi } from '../utils/aqiEngine';

/**
 * AERIS – Global Data Store (Frontend v2)
 * ────────────────────────────────────────────────────────────────
 * Syncs with the Backend API and manages application life-cycle.
 * Uses aqiEngine for EPA-standard sub-AQI, dominant pollutant,
 * trend detection, and EWMA-based forecasting.
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
      console.error('[Store] Profile update failed:', err.message);
      throw err;
    }
  },

  /**
   * Called by the live data listener with ESP32 payload.
   * Merges real sensor data directly into the store.
   */
  updateFromFirebase: (payload) => {
    if (!payload) return;
    set((state) => {
      const base = state.data || {
        meta: { location: 'ESP32 Device', timestamp: Date.now() },
        trend: 'stable',
        alerts: [],
        sectors: [],
        nodes: [],
        history: [],
        forecast: [],
      };

      // Build sensor readings
      const sensorData = {
        pm25: payload.pm25 || 0,
        co: payload.co || 0,
        nox: payload.no2_ppb || payload.nox || 0,
        o3: payload.o3 || 0,
        voc_index: payload.voc || payload.voc_index || 0,
      };

      // Use EPA precision engine for AQI + dominant pollutant
      const aqiResult = computeAqi(sensorData);
      const aqi = payload.aqi || aqiResult.aqi;
      const rri = payload.rri ?? Math.round(aqi * 0.6);

      const newHistoryPoint = {
        timestamp: Date.now(),
        aqi,
        rri,
        pm25: sensorData.pm25,
        co: sensorData.co,
        o3: sensorData.o3,
        nox: sensorData.nox,
        voc_index: sensorData.voc_index,
        temperature: payload.temp || 0,
        humidity: payload.hum || 0,
      };

      const updatedHistory = [...(base.history || []), newHistoryPoint].slice(-60);

      // Detect trend using linear regression
      const trend = detectTrend(updatedHistory);

      // Generate client-side forecast using EWMA
      const forecast = forecastAqi(updatedHistory, 6);

      // Update perNode with full sensor data (including VOC/NOx)
      const perNode = { ...(base.perNode || {}) };
      if (payload.nodeId) {
        const prevNode = perNode[payload.nodeId] || { history: [] };
        const nodeHistoryPoint = {
          timestamp: payload.timestamp || new Date().toISOString(),
          aqi, rri,
          pm25: sensorData.pm25,
          co: sensorData.co, o3: sensorData.o3,
          nox: sensorData.nox, voc_index: sensorData.voc_index,
          temperature: payload.temp || 0, humidity: payload.hum || 0,
        };
        const geoLocation = payload.geo
          ? `${payload.geo.city}, ${payload.geo.region}`
          : prevNode.location || `Sensor ${payload.nodeId}`;
        perNode[payload.nodeId] = {
          latest: {
            aqi, rri,
            pm25: sensorData.pm25,
            co: sensorData.co, o3: sensorData.o3,
            nox: sensorData.nox, voc_index: sensorData.voc_index,
            temperature: payload.temp || 0, humidity: payload.hum || 0,
            timestamp: payload.timestamp || new Date().toISOString(),
          },
          location: geoLocation,
          geo: payload.geo || prevNode.geo || null,
          history: [...(prevNode.history || []), nodeHistoryPoint].slice(-30),
        };
      }

      // Update sectors — always register node even if geo is not yet resolved
      const sectors = [...(base.sectors || [])];
      if (payload.nodeId) {
        const sectorIdx = sectors.findIndex(s => s.id === payload.nodeId);
        const existingSector = sectorIdx >= 0 ? sectors[sectorIdx] : null;
        const sectorData = {
          id: payload.nodeId,
          name: payload.geo
            ? (payload.geo.region ? `${payload.geo.city}, ${payload.geo.region}` : payload.geo.city)
            : existingSector?.name || `Sensor ${payload.nodeId}`,
          aqi, rri,
          status: payload.riskLevel || 'Low',
          lat: payload.geo?.lat || existingSector?.lat || null,
          lng: payload.geo?.lng || existingSector?.lng || null,
        };
        if (sectorIdx >= 0) sectors[sectorIdx] = sectorData;
        else sectors.push(sectorData);
      }

      // Generate dynamic alerts
      const alerts = [...(base.alerts || [])];
      if (aqi > 150 && !alerts.some(a => a.type === 'aqi_high')) {
        alerts.unshift({ type: 'aqi_high', message: `AQI at ${aqi} — unhealthy levels. Limit outdoor exposure.` });
      }
      if (sensorData.co > 9 && !alerts.some(a => a.type === 'co_high')) {
        alerts.unshift({ type: 'co_high', message: `CO at ${sensorData.co.toFixed(1)} ppm — dangerous level. Ensure ventilation.` });
      }
      if (payload.rain) {
        const rainMsg = (payload.pm25RainDelta || 0) > 0
          ? `Rain detected — PM2.5 reduced by ${payload.pm25RainDelta.toFixed(1)} µg/m³. Air quality improving.`
          : 'Rain detected — particulate washout in progress. Air quality may improve.';
        const existing = alerts.findIndex(a => a.type === 'rain');
        if (existing >= 0) alerts.splice(existing, 1);
        alerts.unshift({ type: 'rain', message: rainMsg });
      } else {
        const idx = alerts.findIndex(a => a.type === 'rain');
        if (idx >= 0) alerts.splice(idx, 1);
      }

      return {
        data: {
          ...base,
          meta: { ...base.meta, timestamp: Date.now() },
          sensors: sensorData,
          environment: {
            temperature: payload.temp || 0,
            humidity: payload.hum || 0,
            oxygen: payload.oxygen ?? 21.0,
            pressure: payload.pressure ?? 1013,
            rain: payload.rain || false,
            pm25RainDelta: payload.pm25RainDelta || 0,
          },
          derived: {
            aqi,
            rri,
            subAqis: aqiResult.subAqis,
            dominant: aqiResult.dominant,
            risk_color: payload.color || '#10b981',
            risk_level: payload.riskLevel || 'Low',
            aqi_category: payload.label || 'GOOD',
            air_quality_text: `AQI ${aqi} — ${payload.label || 'Good'}. Dominant: ${aqiResult.dominant}. PM2.5: ${sensorData.pm25.toFixed?.(1) || sensorData.pm25} µg/m³, CO: ${sensorData.co.toFixed?.(1) || sensorData.co} ppm.`,
          },
          trend,
          history: updatedHistory,
          forecast,
          alerts: alerts.slice(0, 5),
          sectors,
          perNode,
        },
        loading: false,
      };
    });
    if (import.meta.env.DEV) {
      console.log('[AERIS] Live data applied to store:', payload);
    }
  },

}));

export default useAerisStore;
