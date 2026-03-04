/**
 * AERIS – Live Data Orchestration Hook
 * ────────────────────────────────────────────────────────────────
 * API-First Architecture:
 * 1. Tries to fetch initial state from the live backend API.
 * 2. Connects to the WebSocket server for real-time telemetry updates.
 * 3. FALLBACK: If the API is unreachable, seamlessly pivots to the 
 *    local Simulator engine to ensure the UI never renders empty.
 */
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAerisStore } from '@/store';
import { generateTick, generateSectorUpdate } from '@/services/simulator';
import { SIMULATION } from '@/config/constants';
import aerisApi from '@/services/aerisApi';
import { API_ENDPOINTS, API_BASE_URL } from '@/config/api';

const useLiveData = () => {
  const intervalRef = useRef(null);
  const socketRef = useRef(null);
  const retryIntervalRef = useRef(null);
  
  const {
    setData,
    updateSensors,
    updateEnvironment,
    updateDerived,
    pushHistory,
    addAlert,
    updateSectors,
    setDataSource,
  } = useAerisStore();

  // ── Simulator Fallback Logic ──────────────────────────────────
  const simulatorTick = useCallback(() => {
    const { sensors: newSensors, alert } = generateTick();

    updateSensors({
      pm25: newSensors.pm25,
      pm10: newSensors.pm10,
      co: newSensors.co,
      nox: newSensors.nox,
      o3: newSensors.o3,
      voc_index: newSensors.voc_index,
    });

    updateEnvironment({
      temperature: newSensors.temperature,
      humidity: newSensors.humidity,
      oxygen: newSensors.oxygen,
      pressure: newSensors.pressure,
    });

    updateDerived();

    const state = useAerisStore.getState();
    pushHistory({
      timestamp: new Date().toISOString(),
      pm25: newSensors.pm25,
      co: newSensors.co,
      o3: newSensors.o3,
      aqi: state.derived.aqi,
      rri: state.derived.rri,
      temperature: newSensors.temperature,
      humidity: newSensors.humidity,
    });

    updateSectors(generateSectorUpdate(useAerisStore.getState().sectors));

    if (alert) addAlert(alert);
  }, [updateSensors, updateEnvironment, updateDerived, pushHistory, addAlert, updateSectors]);

  // ── Main Orchestration ────────────────────────────────────────
  useEffect(() => {
    const connectAPI = async () => {
      try {
        setDataSource('api');
        
        // 1. Initial Fetch from REST APIs
        const [latestRes, historyRes, alertsRes, forecastRes, networkRes, profileRes] = await Promise.all([
          aerisApi.get(API_ENDPOINTS.ENVIRONMENT_LATEST),
          aerisApi.get(API_ENDPOINTS.HISTORY),
          aerisApi.get(API_ENDPOINTS.ALERTS),
          aerisApi.get(API_ENDPOINTS.FORECAST),
          aerisApi.get(API_ENDPOINTS.NETWORK_NODES),
          aerisApi.get(API_ENDPOINTS.PROFILE)
        ]);
        
        // Full Store Sync
        setData({
           meta: latestRes.data.meta,
           sensors: latestRes.data.sensors,
           environment: latestRes.data.environment,
           derived: latestRes.data.derived,
           trend: latestRes.data.trend,
           history: historyRes.data,
           alerts: alertsRes.data,
           forecast: forecastRes.data,
           nodes: networkRes.data.nodes,
           network: networkRes.data.network,
           userProfile: profileRes.data,
        });
        
        // 2. Connect WebSocket for Real-time Streaming
        // Strip the trailing API path suffix to connect to the raw domain root
        const socketUrl = API_BASE_URL.replace('/api/v1', '');
        const socket = io(socketUrl);
        socketRef.current = socket;
        
        socket.on('connect', () => {
           console.log('[AERIS WS] Connected to live telemetry stream.');
        });
        
        // Listen for new sensor readings pushed by the ESP32 ingestion pipeline
        socket.on('environment_update', (payload) => {
           updateSensors({
              pm25: payload.sensors.pm25,
              pm10: payload.sensors.pm10 || Math.round(payload.sensors.pm25 * 1.6),
              co: payload.sensors.co,
              nox: payload.sensors.nox || Math.round(payload.sensors.pm25 * 0.5),
              o3: payload.sensors.o3,
              voc_index: payload.sensors.vocIndex,
           });
           
           updateEnvironment({
              temperature: payload.sensors.temperature,
              humidity: payload.sensors.humidity,
              oxygen: payload.sensors.oxygen,
              pressure: payload.sensors.pressure,
           });
           
           // Ensures store parity locally (could also use the payload.derived directly)
           updateDerived();
           
           const state = useAerisStore.getState();
           pushHistory({
             timestamp: payload.timestamp,
             pm25: payload.sensors.pm25,
             co: payload.sensors.co,
             o3: payload.sensors.o3,
             aqi: state.derived.aqi,
             rri: state.derived.rri,
             temperature: payload.sensors.temperature,
             humidity: payload.sensors.humidity,
           });
        });
        
        // Listen for system intelligence alerts
        socket.on('alert_update', (alerts) => {
           alerts.forEach(alert => addAlert(alert));
        });
        
        socket.on('disconnect', () => {
           console.warn('[AERIS WS] Telemetry stream disconnected.');
        });
        
      } catch (err) {
        // 3. SEAMLESS FALLBACK: If backend is unreachable, pivot to simulation
        console.warn('[AERIS Core] Live API unavailable. Pivoting to local Simulation Engine.', err.message);
        setDataSource('simulator');
        
        // Start simulation immediately if not already running
        if (!intervalRef.current) {
          simulatorTick();
          intervalRef.current = setInterval(simulatorTick, SIMULATION.INTERVAL_MS);
        }

        // 4. RETRY STRATEGY: Attempt to reconnect to API every 30 seconds
        if (!retryIntervalRef.current) {
          retryIntervalRef.current = setInterval(() => {
            console.log('[AERIS Core] Attempting to restore Live API connection...');
            connectAPI();
          }, 30000);
        }
      }
    };

    // Initial connection attempt
    connectAPI();

    // Cleanup routines on unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [simulatorTick, setData, setDataSource, updateSensors, updateEnvironment, updateDerived, pushHistory, addAlert]);

  return { refresh: () => {} };
};

export default useLiveData;
