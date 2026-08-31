import { axiosClient } from './axios-client';

export interface PersonSummary {
  id: string;
  tenantId: string;
  userId?: string;
  type: string;
  displayName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  organizationName?: string;
  email?: string;
  phone: string;
  normalizedPhone: string;
  alternatePhone?: string;
  idType?: string;
  idNumber?: string;
  address?: Record<string, string>;
  dateOfBirth?: string;
  occupation?: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
  hasUserAccount: boolean;
  linkedUserEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonAuditLog {
  _id: string;
  scope: string;
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  changes?: Record<string, unknown>;
  createdAt: string;
}

export interface CreatePersonPayload {
  type?: 'INDIVIDUAL' | 'ORGANIZATION';
  firstName?: string;
  middleName?: string;
  lastName?: string;
  organizationName?: string;
  email?: string;
  phone: string;
  alternatePhone?: string;
  idType?: string;
  idNumber?: string;
  address?: Record<string, string>;
  dateOfBirth?: string;
  occupation?: string;
  notes?: string;
}

export const personApi = {
  listPersons: async (params?: {
    search?: string;
    phone?: string;
    email?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    persons: PersonSummary[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await axiosClient.get('/tenant/persons', { params });
    return response.data.data;
  },

  createPerson: async (data: CreatePersonPayload): Promise<PersonSummary> => {
    const response = await axiosClient.post<{ success: boolean; data: PersonSummary }>(
      '/tenant/persons',
      data
    );
    return response.data.data;
  },

  lookupOrCreatePerson: async (data: {
    phone: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    organizationName?: string;
    email?: string;
  }): Promise<{ created: boolean; person: PersonSummary }> => {
    const response = await axiosClient.post('/tenant/persons/lookup-or-create', data);
    return response.data.data;
  },

  getPersonById: async (personId: string): Promise<PersonSummary> => {
    const response = await axiosClient.get<{ success: boolean; data: PersonSummary }>(
      `/tenant/persons/${personId}`
    );
    return response.data.data;
  },

  updatePerson: async (personId: string, updates: Partial<CreatePersonPayload>): Promise<PersonSummary> => {
    const response = await axiosClient.patch<{ success: boolean; data: PersonSummary }>(
      `/tenant/persons/${personId}`,
      updates
    );
    return response.data.data;
  },

  updatePersonStatus: async (personId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<PersonSummary> => {
    const response = await axiosClient.patch<{ success: boolean; data: PersonSummary }>(
      `/tenant/persons/${personId}/status`,
      { status }
    );
    return response.data.data;
  },

  linkUser: async (personId: string, userId: string): Promise<PersonSummary> => {
    const response = await axiosClient.post<{ success: boolean; data: PersonSummary }>(
      `/tenant/persons/${personId}/link-user`,
      { userId }
    );
    return response.data.data;
  },

  unlinkUser: async (personId: string): Promise<PersonSummary> => {
    const response = await axiosClient.post<{ success: boolean; data: PersonSummary }>(
      `/tenant/persons/${personId}/unlink-user`
    );
    return response.data.data;
  },

  getPersonAuditLogs: async (
    personId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    auditLogs: PersonAuditLog[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await axiosClient.get(`/tenant/persons/${personId}/audit-logs`, { params });
    return response.data.data;
  }
};
