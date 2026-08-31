import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../../pages/auth/LoginPage';
import { AuthProvider } from '../../context/AuthContext';

describe('Frontend LoginPage Component', () => {
  it('renders login form with email and password inputs', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/Loan Management SaaS/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/name@company.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('allows user to enter email and password', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    const emailInput = screen.getByPlaceholderText(/name@company.com/i) as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText(/••••••••••••/i) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret123456!' } });

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('Secret123456!');
  });
});
