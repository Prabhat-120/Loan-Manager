import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const axiosClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Request Interceptor
axiosClient.interceptors.request.use(
  (config) => {
    // Auth token insertion placeholder for feature/authentication module
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ success: boolean; error?: { message: string } }>) => {
    const normalizedError = {
      message: error.response?.data?.error?.message || error.message || 'An unexpected error occurred',
      statusCode: error.response?.status || 500
    };
    return Promise.reject(normalizedError);
  }
);
