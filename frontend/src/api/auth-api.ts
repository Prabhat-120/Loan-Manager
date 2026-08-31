import { axiosClient } from './axios-client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserSummary {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
  status: string;
}

export interface LoginResponse {
  firstLoginRequired: boolean;
  firstLoginToken?: string;
  accessToken?: string;
  refreshToken?: string;
  user: UserSummary;
}

export interface FirstLoginChangePasswordData {
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await axiosClient.post<{ success: boolean; data: LoginResponse }>(
      '/auth/login',
      credentials
    );
    return response.data.data;
  },

  firstLoginChangePassword: async (
    data: FirstLoginChangePasswordData,
    restrictedToken?: string
  ): Promise<{ accessToken: string; refreshToken: string; user: UserSummary }> => {
    const headers = restrictedToken ? { Authorization: `Bearer ${restrictedToken}` } : {};
    const response = await axiosClient.post<{
      success: boolean;
      data: { accessToken: string; refreshToken: string; user: UserSummary };
    }>('/auth/first-login-change-password', data, { headers });
    return response.data.data;
  },

  refreshToken: async (
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> => {
    const response = await axiosClient.post<{
      success: boolean;
      data: { accessToken: string; refreshToken: string };
    }>('/auth/refresh', { refreshToken });
    return response.data.data;
  },

  logout: async (refreshToken?: string): Promise<void> => {
    await axiosClient.post('/auth/logout', { refreshToken });
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await axiosClient.post<{ success: boolean; data: { message: string } }>(
      '/auth/forgot-password',
      { email }
    );
    return response.data.data;
  },

  resetPassword: async (
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ message: string }> => {
    const response = await axiosClient.post<{ success: boolean; data: { message: string } }>(
      '/auth/reset-password',
      { token, newPassword, confirmPassword }
    );
    return response.data.data;
  },

  changePassword: async (data: ChangePasswordData): Promise<{ message: string }> => {
    const response = await axiosClient.post<{ success: boolean; data: { message: string } }>(
      '/auth/change-password',
      data
    );
    return response.data.data;
  },

  getMe: async (): Promise<{ user: UserSummary }> => {
    const response = await axiosClient.get<{ success: boolean; data: { user: UserSummary } }>(
      '/auth/me'
    );
    return response.data.data;
  }
};
