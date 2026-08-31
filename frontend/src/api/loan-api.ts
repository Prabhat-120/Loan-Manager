import { axiosClient } from './axios-client';
import { PersonSummary } from './person-api';

export interface RepaymentScheduleSummary {
  id: string;
  tenantId: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  openingPrincipal: string;
  scheduledPrincipal: string;
  scheduledInterest: string;
  scheduledAmount: string;
  paidPrincipal: string;
  paidInterest: string;
  paidAmount: string;
  remainingAmount: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanSummary {
  id: string;
  tenantId: string;
  loanNumber: string;
  lenderPersonId: string;
  borrowerPersonId: string;
  loanType: 'INTEREST_ONLY' | 'EMI' | 'FULL_PAYMENT';
  principalAmount: string;
  interestRate: string;
  interestRateType: string;
  interestCalculationMethod: 'FLAT' | 'REDUCING_BALANCE';
  termMonths: number;
  startDate: string;
  firstDueDate: string;
  maturityDate?: string;
  paymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  status: 'DRAFT' | 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CLOSED' | 'CANCELLED';
  totalInterest: string;
  totalPayable: string;
  totalPaid: string;
  outstandingPrincipal: string;
  outstandingInterest: string;
  outstandingTotal: string;
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  lender?: PersonSummary;
  borrower?: PersonSummary;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanDetailResponse {
  loan: LoanSummary;
  lender: PersonSummary;
  borrower: PersonSummary;
  financialSummary: {
    principal: string;
    interestRate: string;
    totalInterest: string;
    totalPayable: string;
    totalPaid: string;
    outstandingPrincipal: string;
    outstandingInterest: string;
    outstandingTotal: string;
  };
  scheduleSummary: {
    totalInstallments: number;
    pendingInstallments: number;
    paidInstallments: number;
    overdueInstallments: number;
  };
}

export interface CreateLoanPayload {
  lenderPersonId: string;
  borrowerPersonId: string;
  loanType: 'INTEREST_ONLY' | 'EMI' | 'FULL_PAYMENT';
  principalAmount: number | string;
  interestRate: number | string;
  interestCalculationMethod: 'FLAT' | 'REDUCING_BALANCE';
  termMonths: number;
  startDate: string;
  firstDueDate: string;
  paymentFrequency?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  notes?: string;
}

export interface UpdateDraftLoanPayload {
  lenderPersonId?: string;
  borrowerPersonId?: string;
  loanType?: 'INTEREST_ONLY' | 'EMI' | 'FULL_PAYMENT';
  principalAmount?: number | string;
  interestRate?: number | string;
  interestCalculationMethod?: 'FLAT' | 'REDUCING_BALANCE';
  termMonths?: number;
  startDate?: string;
  firstDueDate?: string;
  paymentFrequency?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  notes?: string;
}

export interface SchedulePreviewResult {
  principalAmount: string;
  totalInterest: string;
  totalPayable: string;
  monthlyEMI?: string;
  schedule: Array<{
    installmentNumber: number;
    dueDate: string;
    openingPrincipal: string;
    scheduledPrincipal: string;
    scheduledInterest: string;
    scheduledAmount: string;
    closingPrincipal: string;
  }>;
}

export const loanApi = {
  listLoans: async (params?: {
    search?: string;
    loanNumber?: string;
    lenderPersonId?: string;
    borrowerPersonId?: string;
    status?: string;
    loanType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    loans: LoanSummary[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await axiosClient.get('/tenant/loans', { params });
    return response.data.data;
  },

  createLoan: async (data: CreateLoanPayload): Promise<LoanDetailResponse> => {
    const response = await axiosClient.post<{ success: boolean; data: LoanDetailResponse }>(
      '/tenant/loans',
      data
    );
    return response.data.data;
  },

  getLoanById: async (loanId: string): Promise<LoanDetailResponse> => {
    const response = await axiosClient.get<{ success: boolean; data: LoanDetailResponse }>(
      `/tenant/loans/${loanId}`
    );
    return response.data.data;
  },

  updateDraftLoan: async (loanId: string, data: UpdateDraftLoanPayload): Promise<LoanDetailResponse> => {
    const response = await axiosClient.patch<{ success: boolean; data: LoanDetailResponse }>(
      `/tenant/loans/${loanId}`,
      data
    );
    return response.data.data;
  },

  activateLoan: async (loanId: string): Promise<LoanDetailResponse> => {
    const response = await axiosClient.post<{ success: boolean; data: LoanDetailResponse }>(
      `/tenant/loans/${loanId}/activate`
    );
    return response.data.data;
  },

  cancelLoan: async (loanId: string): Promise<LoanDetailResponse> => {
    const response = await axiosClient.post<{ success: boolean; data: LoanDetailResponse }>(
      `/tenant/loans/${loanId}/cancel`
    );
    return response.data.data;
  },

  getRepaymentSchedule: async (loanId: string): Promise<RepaymentScheduleSummary[]> => {
    const response = await axiosClient.get<{ success: boolean; data: RepaymentScheduleSummary[] }>(
      `/tenant/loans/${loanId}/schedule`
    );
    return response.data.data;
  },

  previewSchedule: async (data: {
    loanType: string;
    principalAmount: number | string;
    annualInterestRate: number | string;
    interestCalculationMethod: string;
    termMonths: number;
    startDate: string;
    firstDueDate: string;
    paymentFrequency?: string;
  }): Promise<SchedulePreviewResult> => {
    const response = await axiosClient.post<{ success: boolean; data: SchedulePreviewResult }>(
      '/tenant/loans/preview-schedule',
      data
    );
    return response.data.data;
  },

  getLoansGivenByPerson: async (
    personId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    loans: LoanSummary[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await axiosClient.get(`/tenant/persons/${personId}/loans-given`, { params });
    return response.data.data;
  },

  getLoansTakenByPerson: async (
    personId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    loans: LoanSummary[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await axiosClient.get(`/tenant/persons/${personId}/loans-taken`, { params });
    return response.data.data;
  }
};
