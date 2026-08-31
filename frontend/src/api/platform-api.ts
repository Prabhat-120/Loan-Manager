import { axiosClient } from './axios-client';

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  currency: string;
  timezone: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt?: string;
}

export interface PlatformDashboardData {
  metrics: {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    inactiveTenants: number;
    totalUsers: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    nearingExpiryTenants: number;
  };
  recentTenants: TenantSummary[];
}

export interface OnboardTenantInput {
  name: string;
  slug?: string;
  domain?: string;
  currency?: string;
  timezone?: string;
  contactEmail: string;
  contactPhone: string;
  country?: string;
  subscriptionPlan?: string;
  billingCycle?: string;
  ownerEmail: string;
}

export interface OnboardTenantResponse {
  tenant: TenantSummary;
  temporaryPassword: string;
  warning: string;
}

export const platformApi = {
  getDashboard: async (): Promise<PlatformDashboardData> => {
    const response = await axiosClient.get<{ success: boolean; data: PlatformDashboardData }>(
      '/platform/dashboard'
    );
    return response.data.data;
  },

  listTenants: async (params?: { search?: string; status?: string; page?: number }): Promise<{
    tenants: TenantSummary[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await axiosClient.get('/platform/tenants', { params });
    return response.data.data;
  },

  onboardTenant: async (input: OnboardTenantInput): Promise<OnboardTenantResponse> => {
    const response = await axiosClient.post<{ success: boolean; data: OnboardTenantResponse }>(
      '/platform/tenants',
      input
    );
    return response.data.data;
  },

  getTenantById: async (tenantId: string): Promise<any> => {
    const response = await axiosClient.get(`/platform/tenants/${tenantId}`);
    return response.data.data;
  },

  updateTenantStatus: async (tenantId: string, status: string): Promise<TenantSummary> => {
    const response = await axiosClient.patch<{ success: boolean; data: TenantSummary }>(
      `/platform/tenants/${tenantId}/status`,
      { status }
    );
    return response.data.data;
  },

  updateSubscription: async (tenantId: string, subscriptionUpdates: any): Promise<any> => {
    const response = await axiosClient.patch(
      `/platform/tenants/${tenantId}/subscription`,
      subscriptionUpdates
    );
    return response.data.data;
  }
};
