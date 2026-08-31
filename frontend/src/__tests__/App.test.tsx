import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';

// Mock health API to avoid network requests during component render test
vi.mock('../api/health-api', () => ({
  fetchHealth: vi.fn().mockResolvedValue({ status: 'ok', uptime: 100, timestamp: '2026-08-31' }),
  fetchReadiness: vi.fn().mockResolvedValue({ status: 'ready', db: 'connected', timestamp: '2026-08-31' })
}));

describe('Frontend App Foundation', () => {
  it('renders application title and navigation items', async () => {
    render(<App />);
    expect(await screen.findByText('Loan Management SaaS')).toBeInTheDocument();
    expect(screen.getByText('System Dashboard')).toBeInTheDocument();
  });
});
