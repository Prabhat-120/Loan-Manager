import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const axiosClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Helper functions for auth token management
export const getStoredAccessToken = (): string | null => {
  return localStorage.getItem('access_token');
};

export const setStoredAccessToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('access_token', token);
  } else {
    localStorage.removeItem('access_token');
  }
};

export const getStoredRefreshToken = (): string | null => {
  return localStorage.getItem('refresh_token');
};

export const setStoredRefreshToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('refresh_token', token);
  } else {
    localStorage.removeItem('refresh_token');
  }
};

// Request Interceptor
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor with Silent Refresh
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ success: boolean; error?: { message: string } }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url?.includes('/auth/login') && !originalRequest.url?.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(axiosClient(originalRequest));
            },
            reject: (err: unknown) => reject(err)
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        isRefreshing = false;
        setStoredAccessToken(null);
        setStoredRefreshToken(null);
        const normalizedError = {
          message: error.response?.data?.error?.message || 'Authentication session expired',
          statusCode: 401
        };
        return Promise.reject(normalizedError);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;
        setStoredAccessToken(newAccessToken);
        setStoredRefreshToken(newRefreshToken);
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setStoredAccessToken(null);
        setStoredRefreshToken(null);
        const normalizedError = {
          message: 'Session expired. Please log in again.',
          statusCode: 401
        };
        return Promise.reject(normalizedError);
      } finally {
        isRefreshing = false;
      }
    }

    const normalizedError = {
      message: error.response?.data?.error?.message || error.message || 'An unexpected error occurred',
      statusCode: error.response?.status || 500
    };
    return Promise.reject(normalizedError);
  }
);
