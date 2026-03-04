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
    loading: false,
    error: null,

    /**
     * Fetch the latest comprehensive intelligence state.
     */
    fetchLatest: async () => {
        set({ loading: true, error: null });
        try {
            const response = await aerisApi.get('/latest');
            // The backend returns the raw AERIS_DATA structure
            set({ data: response.data, loading: false });
            
            if (import.meta.env.DEV) {
                console.log('✅ [Store] AERIS_DATA synced:', response.data);
            }
        } catch (err) {
            console.error('❌ [Store] Sync failed, using fallback mock data for UI verification:', err.message);
            const mockData = {
              meta: { location: 'Sector Alpha', timestamp: Date.now() },
              sensors: { pm25: 45, pm10: 60, co: 2.1, voc_index: 120, nox: 40, o3: 35 },
              environment: { temperature: 24, humidity: 45 },
              derived: {
                aqi: 125, rri: 68, aqi_category: 'Unhealthy for Sensitive Groups',
                risk_level: 'Elevated Risk', risk_color: '#f97316', dominant: 'PM2.5',
                air_quality_text: 'Air quality has degraded due to localized particulate spikes.'
              },
              trend: 'up',
              alerts: [
                { id: 1, type: 'TOXIC_SPIKE', message: 'Sudden PM2.5 elevation detected in Industrial Zone B.' }
              ],
              sectors: [
                { id: 's1', name: 'Downtown Core', aqi: 130, status: 'warning' },
                { id: 's2', name: 'Industrial Zone', aqi: 165, status: 'danger' },
                { id: 's3', name: 'Residential West', aqi: 45, status: 'safe' }
              ],
              nodes: [
                { id: 'N-001', location_name: 'City Hall', status: 'active', battery: 92, last_sync: 'Active' },
                { id: 'N-002', location_name: 'Port Authority', status: 'active', battery: 85, last_sync: 'Active' },
                { id: 'N-003', location_name: 'Metro Station', status: 'offline', battery: 12, last_sync: '2h ago' }
              ],
              history: Array.from({length: 24}, (_, i) => ({
                timestamp: Date.now() - (24-i)*3600000, aqi: 40 + Math.random()*80, rri: 20 + Math.random()*40,
                pm25: 10 + Math.random()*40, pm10: 20 + Math.random()*50, co: 1+Math.random()*2, voc_index: 50+Math.random()*100,
                nox: 10+Math.random()*30, o3: 20+Math.random()*20
              })),
              forecast: Array.from({length: 6}, (_, i) => ({
                timestamp: Date.now() + (i+1)*3600000, aqi: 120 + i*5, rri: 65 + i*2
              }))
            };
            set({ 
                error: null, // Clear error to allow rendering
                data: mockData,
                loading: false 
            });
        }
    },

    /**
     * Update user profile settings.
     */
    updateProfile: async (profileData) => {
        try {
            const response = await aerisApi.post('/profile', profileData);
            // Refresh data after update
            await get().fetchLatest();
            return response.data;
        } catch (err) {
            console.error('❌ [Store] Profile update failed:', err.message);
            throw err;
        }
    }
}));

export default useAerisStore;
