import { axiosClient } from './axios-client';
import { PersonSummary } from './person-api';
import { LoanSummary } from './loan-api';

export type PaymentMethodType = 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'OTHER';
export type PaymentStatusType = 'POSTED' | 'REVERSED';

export interface PaymentSummary {
  id: string;
  tenantId: string;
  paymentNumber: string;
  loanId: string;
  loanNumber?: string;
  borrowerPersonId: string;
  borrowerName?: string;
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethodType;
  referenceNumber?: string;
  notes?: string;
  status: PaymentStatusType;
  allocatedInterest: string;
  allocatedPrincipal: string;
  unallocatedAmount: string;
  createdBy: string;
  reversedBy?: string;
  reversedAt?: string;
  reversalReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentScheduleAllocationItem {
  id: string;
  tenantId: string;
  paymentId: string;
  loanId: string;
  scheduleId: string;
  installmentNumber: number;
  dueDate?: string;
  interestAmount: string;
  principalAmount: string;
  totalAmount: string;
  createdAt?: string;
}

export interface PaymentDetailResponse {
  payment: PaymentSummary;
  loan: LoanSummary;
  borrower: PersonSummary;
  allocationSummary: {
    allocatedInterest: string;
    allocatedPrincipal: string;
    unallocatedAmount: string;
    totalAmount: string;
  };
  scheduleAllocations: PaymentScheduleAllocationItem[];
}

export interface PaymentPreviewResponse {
  loanId: string;
  loanNumber: string;
  paymentAmount: string;
  allocatedInterest: string;
  allocatedPrincipal: string;
  unallocatedAmount: string;
  allSchedulesSatisfied: boolean;
  scheduleAllocations: Array<{
    scheduleId: string;
    installmentNumber: number;
    dueDate: string;
    scheduledAmount: string;
    scheduledPrincipal: string;
    scheduledInterest: string;
    allocatedPrincipal: string;
    allocatedInterest: string;
    allocatedTotal: string;
    remainingAfterPayment: string;
    statusAfterPayment: string;
  }>;
}

export interface LoanPaymentHistoryResponse {
  payments: PaymentSummary[];
  totalPayments: number;
  totalPaid: string;
  totalInterestPaid: string;
  totalPrincipalPaid: string;
  outstandingPrincipal: string;
  outstandingInterest: string;
  outstandingTotal: string;
}

export interface CreatePaymentInput {
  loanId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethodType;
  referenceNumber?: string;
  notes?: string;
}

export interface ListPaymentsParams {
  loanId?: string;
  borrowerPersonId?: string;
  paymentMethod?: PaymentMethodType;
  status?: PaymentStatusType;
  dateFrom?: string;
  dateTo?: string;
  referenceNumber?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListPaymentsResponse {
  data: PaymentSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const paymentApi = {
  async listPayments(params?: ListPaymentsParams): Promise<ListPaymentsResponse> {
    const res = await axiosClient.get('/tenant/payments', { params });
    return {
      data: res.data.data,
      pagination: res.data.pagination
    };
  },

  async getPaymentById(paymentId: string): Promise<PaymentDetailResponse> {
    const res = await axiosClient.get(`/tenant/payments/${paymentId}`);
    return res.data.data;
  },

  async previewPayment(input: { loanId: string; amount: number; paymentDate?: string }): Promise<PaymentPreviewResponse> {
    const res = await axiosClient.post('/tenant/payments/preview', input);
    return res.data.data;
  },

  async createPayment(input: CreatePaymentInput, idempotencyKey?: string): Promise<{ data: PaymentSummary; isDuplicate: boolean }> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const res = await axiosClient.post('/tenant/payments', input, { headers });
    return {
      data: res.data.data,
      isDuplicate: res.data.isDuplicate || false
    };
  },

  async reversePayment(paymentId: string, reason: string): Promise<PaymentDetailResponse> {
    const res = await axiosClient.post(`/tenant/payments/${paymentId}/reverse`, { reason });
    return res.data.data;
  },

  async getLoanPaymentHistory(loanId: string): Promise<LoanPaymentHistoryResponse> {
    const res = await axiosClient.get(`/tenant/loans/${loanId}/payments`);
    return res.data.data;
  }
};
