import axios from 'axios';
import { useAuthStore } from '../features/auth/authStore.js';

const API_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 and network errors (e.g. stale token pointing to wrong host).
// Los endpoints de login/registro se EXCLUYEN del auto-logout: un 401 ahí
// (token de Google inválido, client_id descasado) es un fallo del intento de
// acceso que la propia página debe mostrar — no una sesión caducada. Sin esta
// exclusión, el interceptor hacía un hard-reload que se comía el mensaje de
// error de LoginPage.
const isAuthAttempt = (url: string | undefined): boolean =>
  !!url && (url.includes('/auth/login') || url.includes('/auth/register'));

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAuthAttempt(error.config?.url)) {
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    } else if (!error.response && useAuthStore.getState().token) {
      // Network error with a stored token → likely stale/bad config, force logout
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
