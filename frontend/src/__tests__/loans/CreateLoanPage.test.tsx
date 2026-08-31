import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateLoanPage } from '../../pages/loans/CreateLoanPage';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/person-api', () => ({
  personApi: {
    listPersons: vi.fn().mockResolvedValue({
      persons: [
        { id: 'p1', displayName: 'Alice Lender', phone: '+919876543210', type: 'INDIVIDUAL', status: 'ACTIVE' },
        { id: 'p2', displayName: 'Bob Borrower', phone: '+919876543211', type: 'INDIVIDUAL', status: 'ACTIVE' }
      ],
      pagination: { page: 1, limit: 10, total: 2, pages: 1 }
    })
  }
}));

const mockAuthContextValue = {
  user: { id: 'u1', email: 'owner@alpha.com', role: 'TENANT_OWNER', status: 'ACTIVE', firstLogin: false },
  isAuthenticated: true,
  isLoading: false
};

describe('Frontend CreateLoanPage Wizard Component', () => {
  it('renders Step 1 (Select Lender) and advances to Step 2 upon selecting a person', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthContext.Provider value={mockAuthContextValue as any}>
            <CreateLoanPage />
          </AuthContext.Provider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Create New Loan')).toBeInTheDocument();
    expect(screen.getByText(/Step 1: Select Lender/i)).toBeInTheDocument();

    const aliceCard = await screen.findByText('Alice Lender');
    expect(aliceCard).toBeInTheDocument();

    // Click on Alice Lender
    fireEvent.click(aliceCard);

    // Click Continue
    const continueBtn = screen.getByRole('button', { name: /Continue →/i });
    fireEvent.click(continueBtn);

    // Now Step 2 should be active
    expect(screen.getByText(/Step 2: Select Borrower/i)).toBeInTheDocument();
  });
});
