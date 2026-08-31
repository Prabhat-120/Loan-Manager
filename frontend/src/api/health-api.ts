import { axiosClient } from './axios-client';

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

export interface ReadinessResponse {
  status: string;
  db: string;
  timestamp: string;
}

export const fetchHealth = async (): Promise<HealthResponse> => {
  const response = await axiosClient.get<HealthResponse>('/health');
  return response.data;
};

export const fetchReadiness = async (): Promise<ReadinessResponse> => {
  const response = await axiosClient.get<ReadinessResponse>('/health/ready');
  return response.data;
};
