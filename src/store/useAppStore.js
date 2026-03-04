/**
 * AERIS – UI App Store (Zustand + persist)
 * UI-only state: theme, sidebar, location, view preferences.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/constants';

const useAppStore = create(
  persist(
    (set) => ({
      // ── Theme ──────────────────────────────────────────────
      theme: 'dark',
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      // ── Current Sector ─────────────────────────────────────
      currentLocationId: 'sector-a',
      setCurrentLocationId: (id) => set({ currentLocationId: id }),

      // ── Sidebar ────────────────────────────────────────────
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // ── Active Parameter ───────────────────────────────────
      activeParamId: 'rri',
      setActiveParam: (id) => set({ activeParamId: id }),

      // ── Time Range ─────────────────────────────────────────
      timeRange: '24h',
      setTimeRange: (range) => set({ timeRange: range }),

      // ── Connectivity ───────────────────────────────────────
      isOnline: true,
      setOnline: (v) => set({ isOnline: v }),
    }),
    {
      name: STORAGE_KEYS.APP_STATE,
    }
  )
);

export default useAppStore;
