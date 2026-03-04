import axios from 'axios';

/**
 * AERIS – API Client
 * ────────────────────────────────────────────────────────────────
 * Configured Axios instance for communicating with the AERIS Backend.
 */

const aerisApi = axios.create({
    baseURL: 'http://localhost:5001/api/v1',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor for logging in development
if (import.meta.env.DEV) {
    aerisApi.interceptors.response.use(
        (response) => response,
        (error) => {
            console.error('📡 [API Error]', error.response?.data || error.message);
            return Promise.reject(error);
        }
    );
}

export default aerisApi;
