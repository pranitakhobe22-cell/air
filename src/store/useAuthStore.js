/**
 * AERIS – Auth Store
 * Holds the logged-in user's identity and provides rehydration from localStorage.
 */
import { create } from 'zustand';
import aerisApi from '../services/aerisApi';

const useAuthStore = create((set, get) => ({
    user: null,          // { id, name, email }
    isLoading: false,

    /** Populate user after login/register */
    setUser: (user) => set({ user }),

    /** Clear user on logout */
    clearUser: () => set({ user: null }),

    /**
     * Rehydrate user from the stored JWT by hitting GET /auth/me.
     * Called once on app load.
     */
    fetchMe: async () => {
        const token = localStorage.getItem('aeris_auth_token');
        if (!token) return;

        // Try fast path first: restore from localStorage cache
        const cached = localStorage.getItem('aeris_user');
        if (cached) {
            try { set({ user: JSON.parse(cached) }); } catch (_) { }
        }

        set({ isLoading: true });
        try {
            const res = await aerisApi.get('/auth/me');
            if (res.data?.success) {
                const user = res.data.data;
                set({ user });
                localStorage.setItem('aeris_user', JSON.stringify(user));
            }
        } catch (e) {
            // Token may be expired — clear it
            if (e.response?.status === 401) {
                localStorage.removeItem('aeris_auth_token');
                localStorage.removeItem('aeris_user');
                set({ user: null });
            }
        } finally {
            set({ isLoading: false });
        }
    },
}));

export default useAuthStore;
