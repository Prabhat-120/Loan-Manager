import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoanDetailPage } from '../../pages/loans/LoanDetailPage';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/loan-api', () => ({
  loanApi: {
    getLoanById: vi.fn().mockResolvedValue({
      loan: {
        id: 'loan-123',
        loanNumber: 'LN-2026-000042',
        loanType: 'EMI',
        paymentFrequency: 'MONTHLY',
        termMonths: 12,
        status: 'DRAFT',
        principalAmount: '100000.00',
        interestRate: '12.00',
        interestCalculationMethod: 'REDUCING_BALANCE',
        totalInterest: '6618.56',
        totalPayable: '106618.56',
        totalPaid: '0.00',
        outstandingPrincipal: '100000.00',
        outstandingInterest: '6618.56',
        outstandingTotal: '106618.56',
        startDate: '2026-01-01',
        firstDueDate: '2026-02-01'
      },
      lender: { id: 'p1', displayName: 'Alice Lender', phone: '+919876543210', type: 'INDIVIDUAL' },
      borrower: { id: 'p2', displayName: 'Bob Borrower', phone: '+919876543211', type: 'INDIVIDUAL' },
      financialSummary: {
        principal: '100000.00',
        interestRate: '12.00',
        totalInterest: '6618.56',
        totalPayable: '106618.56',
        totalPaid: '0.00',
        outstandingPrincipal: '100000.00',
        outstandingInterest: '6618.56',
        outstandingTotal: '106618.56'
      },
      scheduleSummary: {
        totalInstallments: 12,
        pendingInstallments: 12,
        paidInstallments: 0,
        overdueInstallments: 0
      }
    }),
    activateLoan: vi.fn(),
    cancelLoan: vi.fn()
  }
}));

const mockAuthContextValue = {
  user: { id: 'u1', email: 'owner@alpha.com', role: 'TENANT_OWNER', status: 'ACTIVE', firstLogin: false },
  isAuthenticated: true,
  isLoading: false
};

describe('Frontend LoanDetailPage Component', () => {
  it('renders loan header, financial breakdown, participants, and Activate button for DRAFT loan', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/loans/loan-123']}>
          <AuthContext.Provider value={mockAuthContextValue as any}>
            <Routes>
              <Route path="/loans/:loanId" element={<LoanDetailPage />} />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const loanNumber = await screen.findByText('LN-2026-000042');
    expect(loanNumber).toBeInTheDocument();
    expect(screen.getByText('Alice Lender')).toBeInTheDocument();
    expect(screen.getByText('Bob Borrower')).toBeInTheDocument();
    expect(screen.getByText('Financial Breakdown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /✓ Activate Loan/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Full Schedule/i })).toBeInTheDocument();
  });
});
