import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentListPage } from '../../pages/payments/PaymentListPage';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/payment-api', () => ({
  paymentApi: {
    listPayments: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'pmt-1',
          tenantId: 't1',
          paymentNumber: 'PMT-2026-000001',
          loanId: 'l1',
          loanNumber: 'LN-2026-000001',
          borrowerPersonId: 'p1',
          borrowerName: 'John Borrower',
          amount: '8884.88',
          paymentDate: '2026-02-01',
          paymentMethod: 'UPI',
          referenceNumber: 'UPI-123456',
          status: 'POSTED',
          allocatedInterest: '1000.00',
          allocatedPrincipal: '7884.88',
          unallocatedAmount: '0.00',
          createdBy: 'u1'
        }
      ],
      pagination: { total: 1, page: 1, limit: 15, totalPages: 1 }
    })
  }
}));

const mockAuthOwner = {
  user: { id: 'u1', email: 'owner@tenant.com', role: 'TENANT_OWNER', status: 'ACTIVE', firstLogin: false },
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

describe('Frontend PaymentListPage Component', () => {
  it('renders payment list page with ledger headers, filters, table data, and + Record Payment button', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthContext.Provider value={mockAuthOwner as any}>
            <PaymentListPage />
          </AuthContext.Provider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Payments Ledger')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /\+ Record Payment/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. UPI-9988\.\.\./i)).toBeInTheDocument();

    expect(await screen.findByText('PMT-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('LN-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('John Borrower')).toBeInTheDocument();
    expect(screen.getAllByText('POSTED').length).toBeGreaterThanOrEqual(1);
  });

  it('hides + Record Payment button for READ_ONLY user', async () => {
    const readOnlyAuth = {
      ...mockAuthOwner,
      user: { ...mockAuthOwner.user, role: 'READ_ONLY' }
    };

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthContext.Provider value={readOnlyAuth as any}>
            <PaymentListPage />
          </AuthContext.Provider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Payments Ledger')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /\+ Record Payment/i })).not.toBeInTheDocument();
  });
});
