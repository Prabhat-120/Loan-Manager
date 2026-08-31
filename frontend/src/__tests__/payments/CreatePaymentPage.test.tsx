import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreatePaymentPage } from '../../pages/payments/CreatePaymentPage';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/loan-api', () => ({
  loanApi: {
    listLoans: vi.fn().mockResolvedValue({
      loans: [
        {
          id: 'l1',
          loanNumber: 'LN-2026-000001',
          principalAmount: '100000.00',
          outstandingTotal: '106618.56',
          status: 'ACTIVE',
          borrower: { id: 'p1', displayName: 'John Borrower' }
        }
      ]
    }),
    getLoanById: vi.fn().mockResolvedValue({
      loan: {
        id: 'l1',
        loanNumber: 'LN-2026-000001',
        loanType: 'EMI',
        status: 'ACTIVE'
      },
      borrower: {
        id: 'p1',
        displayName: 'John Borrower'
      },
      financialSummary: {
        outstandingPrincipal: '100000.00',
        outstandingInterest: '6618.56',
        outstandingTotal: '106618.56'
      }
    })
  }
}));

vi.mock('../../api/payment-api', () => ({
  paymentApi: {
    previewPayment: vi.fn().mockResolvedValue({
      loanId: 'l1',
      loanNumber: 'LN-2026-000001',
      paymentAmount: '8884.88',
      allocatedInterest: '1000.00',
      allocatedPrincipal: '7884.88',
      unallocatedAmount: '0.00',
      allSchedulesSatisfied: false,
      scheduleAllocations: [
        {
          scheduleId: 's1',
          installmentNumber: 1,
          dueDate: '2026-02-01',
          scheduledAmount: '8884.88',
          allocatedPrincipal: '7884.88',
          allocatedInterest: '1000.00',
          allocatedTotal: '8884.88',
          remainingAfterPayment: '0.00',
          statusAfterPayment: 'PAID'
        }
      ]
    }),
    createPayment: vi.fn().mockResolvedValue({
      data: {
        id: 'pmt-new-1',
        paymentNumber: 'PMT-2026-000001',
        status: 'POSTED'
      },
      isDuplicate: false
    })
  }
}));

const mockAuth = {
  user: { id: 'u1', email: 'officer@tenant.com', role: 'LOAN_OFFICER', status: 'ACTIVE', firstLogin: false },
  accessToken: 'token',
  refreshToken: 'refresh',
  isAuthenticated: true,
  isLoading: false,
  firstLoginRequired: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  setFirstLoginRequired: vi.fn()
};

describe('Frontend CreatePaymentPage Component', () => {
  it('renders payment recording form and triggers live preview when loan and amount are provided', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthContext.Provider value={mockAuth as any}>
            <CreatePaymentPage />
          </AuthContext.Provider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Record Loan Payment')).toBeInTheDocument();
    expect(screen.getByText('1. Target Loan Selection')).toBeInTheDocument();
    expect(screen.getByText('2. Payment Details')).toBeInTheDocument();

    // Select Loan
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Select Active \/ Payable Loan/i })).toBeInTheDocument();
    });

    const loanSelect = screen.getByRole('combobox', { name: /Select Active \/ Payable Loan/i });
    fireEvent.change(loanSelect, { target: { value: 'l1' } });

    // Enter Amount
    const amountInput = screen.getByPlaceholderText(/e\.g\. 5000\.00/i);
    fireEvent.change(amountInput, { target: { value: '8884.88' } });

    // Live preview should render
    await waitFor(() => {
      expect(screen.getByText('Authoritative Allocation Preview')).toBeInTheDocument();
      expect(screen.getByText('Interest Allocation')).toBeInTheDocument();
      expect(screen.getByText('Principal Allocation')).toBeInTheDocument();
    });
  });
});
