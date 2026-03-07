/**
 * AERIS API Configuration
 * ────────────────────────────────────────────────────────────────
 * Centralized configuration for all API endpoints.
 * All URLs are relative to the VITE_API_URL environment variable.
 * Fallbacks to simulator if unavailable.
 */

// Use environment variable for base URL, default to Railway for dev
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aeris-backend-production.up.railway.app/api/v1';

export const API_ENDPOINTS = {
  // Environment and Sensors
  ENVIRONMENT_LATEST: '/environment/latest',

  // Historical and Forecasting
  HISTORY: '/history',
  FORECAST: '/forecast',

  // Intelligent Events
  ALERTS: '/alerts',

  // Network Infrastructure
  NETWORK_NODES: '/network/nodes',

  // User Management
  PROFILE: '/profile',

  // Authentication
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_ME: '/auth/me',
};

// Polling interval (in milliseconds)
export const API_POLLING_INTERVAL = 10000;
