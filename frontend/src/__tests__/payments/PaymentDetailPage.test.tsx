import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentDetailPage } from '../../pages/payments/PaymentDetailPage';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/payment-api', () => ({
  paymentApi: {
    getPaymentById: vi.fn().mockResolvedValue({
      payment: {
        id: 'pmt-1',
        tenantId: 't1',
        paymentNumber: 'PMT-2026-000001',
        loanId: 'l1',
        loanNumber: 'LN-2026-000001',
        borrowerPersonId: 'p1',
        amount: '8884.88',
        paymentDate: '2026-02-01',
        paymentMethod: 'UPI',
        referenceNumber: 'UPI-123456',
        status: 'POSTED',
        allocatedInterest: '1000.00',
        allocatedPrincipal: '7884.88',
        unallocatedAmount: '0.00',
        createdBy: 'u1',
        createdAt: '2026-02-01T10:00:00Z'
      },
      loan: {
        id: 'l1',
        loanNumber: 'LN-2026-000001',
        loanType: 'EMI',
        principalAmount: '100000.00',
        status: 'PARTIALLY_PAID'
      },
      borrower: {
        id: 'p1',
        displayName: 'John Borrower',
        phone: '+919876543210',
        type: 'INDIVIDUAL',
        status: 'ACTIVE'
      },
      allocationSummary: {
        allocatedInterest: '1000.00',
        allocatedPrincipal: '7884.88',
        unallocatedAmount: '0.00',
        totalAmount: '8884.88'
      },
      scheduleAllocations: [
        {
          id: 'alloc-1',
          installmentNumber: 1,
          dueDate: '2026-02-01',
          interestAmount: '1000.00',
          principalAmount: '7884.88',
          totalAmount: '8884.88'
        }
      ]
    }),
    reversePayment: vi.fn().mockResolvedValue({
      payment: {
        id: 'pmt-1',
        status: 'REVERSED'
      }
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

describe('Frontend PaymentDetailPage Component', () => {
  it('renders payment details, allocation breakdown, and opens Reverse Payment modal for TENANT_OWNER', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/payments/pmt-1']}>
          <AuthContext.Provider value={mockAuthOwner as any}>
            <Routes>
              <Route path="/payments/:paymentId" element={<PaymentDetailPage />} />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('PMT-2026-000001')).toBeInTheDocument();
      expect(screen.getByText('POSTED')).toBeInTheDocument();
      expect(screen.getByText('LN-2026-000001')).toBeInTheDocument();
      expect(screen.getByText('John Borrower')).toBeInTheDocument();
      expect(screen.getByText('Allocation Breakdown')).toBeInTheDocument();
    });

    const reverseBtn = screen.getByRole('button', { name: /⚠ Reverse Payment/i });
    expect(reverseBtn).toBeInTheDocument();
    fireEvent.click(reverseBtn);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Important Financial Warning:')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/State the justification for reversing/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirm Reversal/i })).toBeInTheDocument();
    });
  });
});
