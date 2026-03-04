import aerisApi from './aerisApi';
import { API_ENDPOINTS } from '@/config/api';

/**
 * Handle user login and store JWT token locally.
 */
export const login = async (email, password) => {
  try {
    const response = await aerisApi.post(API_ENDPOINTS.AUTH_LOGIN, { email, password });
    if (response.data.success && response.data.token) {
      localStorage.setItem('aeris_auth_token', response.data.token);
      return response.data;
    }
    throw new Error(response.data.error || 'Login failed');
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Login failed');
  }
};

/**
 * Handle user registration and store JWT token locally.
 */
export const registerUser = async (name, email, password) => {
  try {
    const response = await aerisApi.post(API_ENDPOINTS.AUTH_REGISTER, { name, email, password });
    if (response.data.success && response.data.token) {
      localStorage.setItem('aeris_auth_token', response.data.token);
      return response.data;
    }
    throw new Error(response.data.error || 'Registration failed');
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'Registration failed');
  }
};

/**
 * Remove token and logout user.
 */
export const logout = () => {
  localStorage.removeItem('aeris_auth_token');
  window.location.href = '/login';
};

/**
 * Check if the user is currently authenticated via JWT token presence.
 */
export const isAuthenticated = () => {
  return !!localStorage.getItem('aeris_auth_token');
};
