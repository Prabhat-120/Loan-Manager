import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoanListPage } from '../../pages/loans/LoanListPage';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/loan-api', () => ({
  loanApi: {
    listLoans: vi.fn().mockResolvedValue({
      loans: [
        {
          id: 'loan-1',
          loanNumber: 'LN-2026-000001',
          principalAmount: '100000.00',
          interestRate: '12.00',
          loanType: 'EMI',
          outstandingTotal: '106618.56',
          status: 'ACTIVE',
          startDate: '2026-01-01',
          lender: { id: 'p1', displayName: 'Alice Lender' },
          borrower: { id: 'p2', displayName: 'Bob Borrower' }
        }
      ],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 }
    })
  }
}));

const mockAuthContextValue = {
  user: { id: 'u1', email: 'owner@alpha.com', role: 'TENANT_OWNER', status: 'ACTIVE', firstLogin: false },
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

describe('Frontend LoanListPage Component', () => {
  it('renders loan list page with header, search input, and + Create Loan button for TENANT_OWNER', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthContext.Provider value={mockAuthContextValue as any}>
            <LoanListPage />
          </AuthContext.Provider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Loan Management')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Loan # or Person name/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /\+ Create Loan/i })).toBeInTheDocument();

    const loanNumber = await screen.findByText('LN-2026-000001');
    expect(loanNumber).toBeInTheDocument();
    expect(screen.getByText('Alice Lender')).toBeInTheDocument();
    expect(screen.getByText('Bob Borrower')).toBeInTheDocument();
  });

  it('hides + Create Loan button when logged in as READ_ONLY', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const readOnlyAuth = {
      ...mockAuthContextValue,
      user: { ...mockAuthContextValue.user, role: 'READ_ONLY' }
    };

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthContext.Provider value={readOnlyAuth as any}>
            <LoanListPage />
          </AuthContext.Provider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByRole('link', { name: /\+ Create Loan/i })).not.toBeInTheDocument();
  });
});
