/**
 * AERIS – Live Data Orchestration Hook
 * ────────────────────────────────────────────────────────────────
 * Socket.IO-First Architecture:
 * 1. Connects to the AERIS WebSocket server (port 3000).
 * 2. Any ESP32 push via `environment_update` → updates the store instantly.
 * 3. FALLBACK: If no socket data arrives within 5 s, fetch the LAST REAL
 *    reading from Cosmos DB via the REST API. Shows real data, not simulated.
 */
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useAerisStore from '@/store/aerisStore';
import aerisApi from '@/services/aerisApi';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
const SOCKET_TIMEOUT_MS = 5000;

const RISK_COLORS = {
    Low: '#10b981',
    Moderate: '#f59e0b',
    High: '#f97316',
    'Very High': '#ef4444',
    Hazardous: '#7c3aed',
};

const useLiveData = () => {
    const socketRef = useRef(null);
    const fallbackTimer = useRef(null);
    const hasRealData = useRef(false);

    const updateFromFirebase = useAerisStore((s) => s.updateFromFirebase);
    const fetchLatest = useAerisStore((s) => s.fetchLatest);

    // ── Fetch last DB record as fallback ─────────────────────────
    const fetchLastDBRecord = useCallback(async () => {
        if (hasRealData.current) return;
        try {
            console.info('[AERIS] No live ESP32 data — loading last record from Cosmos DB...');
            await fetchLatest(); // calls GET /api/v1/latest → reads Cosmos DB
        } catch (err) {
            console.warn('[AERIS] Could not load last DB record:', err.message);
        }
    }, [fetchLatest]);

    // ── Main Effect ───────────────────────────────────────────────
    useEffect(() => {
        // Fetch last DB record immediately on load (so UI isn't blank)
        fetchLastDBRecord();

        const socket = io(WS_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('environment_update', (payload) => {
            hasRealData.current = true;

            if (fallbackTimer.current) {
                clearTimeout(fallbackTimer.current);
                fallbackTimer.current = null;
            }

            // Backend sends { timestamp, source } as notification — re-fetch latest from REST
            if (!payload?.sensors) {
                if (import.meta.env.DEV) {
                    console.log('[AERIS] WebSocket notification received — refreshing from REST');
                }
                fetchLatest();
                return;
            }

            // Full sensor payload (future / direct ESP push)
            updateFromFirebase({
                nodeId: payload.nodeId || null,
                timestamp: payload.timestamp || new Date().toISOString(),
                pm25: payload.sensors.pm25 || 0,
                pm10: payload.sensors.pm10 || 0,
                o3: payload.sensors.o3 || 0,
                co: payload.sensors.co || 0,
                no2_ppb: payload.sensors.no2 || payload.sensors.nox || 0,
                nox: payload.sensors.nox || payload.sensors.no2 || 0,
                voc: payload.sensors.vocIndex || payload.sensors.voc || payload.sensors.voc_index || 0,
                temp: payload.sensors.temperature || 0,
                hum: payload.sensors.humidity || 0,
                oxygen: payload.sensors.oxygen ?? null,
                pressure: payload.sensors.pressure ?? null,
                rain: payload.sensors.rain || false,
                pm25RainDelta: payload.sensors.pm25RainDelta || 0,
                aqi: payload.derived?.aqi || 0,
                rri: payload.derived?.rri || 0,
                label: payload.derived?.aqiCategory || 'UNKNOWN',
                riskLevel: payload.derived?.riskLevel || 'Low',
                color: RISK_COLORS[payload.derived?.riskLevel] || '#10b981',
                geo: payload.geo || null,
            });

            if (import.meta.env.DEV) {
                console.log('[ESP32] Live:', payload.nodeId, 'AQI:', payload.derived?.aqi);
            }
        });

        socket.on('connect', () => {
            console.log('[AERIS] WebSocket connected to backend');
        });

        socket.on('disconnect', () => {
            console.warn('[AERIS] WebSocket disconnected — showing last known DB data');
            if (!hasRealData.current) fetchLastDBRecord();
        });

        // After timeout, re-poll DB for freshest record (in case ESP32 was recently on)
        fallbackTimer.current = setTimeout(() => {
            if (!hasRealData.current) {
                console.warn('[AERIS] No ESP32 data after 5s — refreshing last DB record.');
                fetchLastDBRecord();
            }
        }, SOCKET_TIMEOUT_MS);

        return () => {
            socket.disconnect();
            if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
        };
    }, [fetchLastDBRecord, updateFromFirebase]);

    return { refresh: fetchLastDBRecord };
};

export default useLiveData;
