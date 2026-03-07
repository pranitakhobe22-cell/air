import axios from 'axios';

/**
 * AERIS – API Client
 * ────────────────────────────────────────────────────────────────
 * Configured Axios instance for communicating with the AERIS Backend.
 */

const aerisApi = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Attach JWT token from localStorage to every request
aerisApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('aeris_auth_token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// Retry logic for network failures and 5xx errors (max 2 retries with backoff)
aerisApi.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;
        const isRetryable = !error.response || error.response.status >= 500;

        if (!config._retryCount) config._retryCount = 0;

        if (isRetryable && config._retryCount < 2) {
            config._retryCount += 1;
            await new Promise(r => setTimeout(r, config._retryCount * 1500));
            return aerisApi(config);
        }

        if (import.meta.env.DEV) {
            console.error('[API Error]', error.response?.data || error.message);
        }
        return Promise.reject(error);
    }
);

export default aerisApi;
