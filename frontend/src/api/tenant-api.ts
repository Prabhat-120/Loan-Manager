import { axiosClient } from './axios-client';

export interface TenantUserSummary {
  id: string;
  email: string;
  role: string;
  status: string;
  firstLogin: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface TenantDashboardData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    currency: string;
    timezone: string;
  };
  subscription: {
    plan: string;
    status: string;
    billingCycle: string;
    currentPeriodEnd: string;
    limits: {
      maxUsers: number;
      maxActiveLoans: number;
      maxPeople: number;
    };
  } | null;
  stats: {
    userCount: number;
    personCount: number;
    activeLoanCount: number;
  };
}

export const tenantApi = {
  getProfile: async (): Promise<any> => {
    const response = await axiosClient.get('/tenant');
    return response.data.data;
  },

  updateProfile: async (updates: any): Promise<any> => {
    const response = await axiosClient.patch('/tenant', updates);
    return response.data.data;
  },

  getDashboard: async (): Promise<TenantDashboardData> => {
    const response = await axiosClient.get<{ success: boolean; data: TenantDashboardData }>(
      '/tenant/dashboard'
    );
    return response.data.data;
  },

  getSubscription: async (): Promise<any> => {
    const response = await axiosClient.get('/tenant/subscription');
    return response.data.data;
  },

  listUsers: async (): Promise<TenantUserSummary[]> => {
    const response = await axiosClient.get<{ success: boolean; data: TenantUserSummary[] }>(
      '/tenant/users'
    );
    return response.data.data;
  },

  inviteUser: async (data: { email: string; role: string; personId?: string }): Promise<{
    user: TenantUserSummary;
    temporaryPassword: string;
    warning: string;
  }> => {
    const response = await axiosClient.post('/tenant/users', data);
    return response.data.data;
  },

  updateUserRole: async (userId: string, role: string): Promise<TenantUserSummary> => {
    const response = await axiosClient.patch(`/tenant/users/${userId}/role`, { role });
    return response.data.data;
  },

  updateUserStatus: async (userId: string, status: string): Promise<TenantUserSummary> => {
    const response = await axiosClient.patch(`/tenant/users/${userId}/status`, { status });
    return response.data.data;
  },

  lookupOrCreatePerson: async (data: { phone: string; displayName?: string; firstName?: string; lastName?: string }): Promise<{ created: boolean; person: any }> => {
    const response = await axiosClient.post('/tenant/persons/lookup-or-create', data);
    return response.data.data;
  }
};
