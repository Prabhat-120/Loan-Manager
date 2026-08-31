import { describe, it, expect } from 'vitest';
import {
  calculateEMI,
  calculateSimpleInterest,
  calculatePeriodicInterest,
  calculateEMISchedule,
  calculateInterestOnlySchedule,
  calculateFullPaymentSchedule,
  calculateLoanTotals,
  LoanType,
  InterestCalculationMethod,
  PaymentFrequency
} from '../../modules/loans/calculations/calculations.js';

describe('Loan Calculation Engine Tests', () => {
  const startDate = new Date('2026-01-01');
  const firstDueDate = new Date('2026-02-01');

  describe('Scenario A: Interest-Only Loan', () => {
    it('calculates monthly interest accurately for ₹100,000 @ 12% p.a.', () => {
      // Periodic monthly interest: 100000 * 12% / 12 = 1000
      const periodicInterest = calculatePeriodicInterest(100000, 12, PaymentFrequency.MONTHLY);
      expect(periodicInterest.toFixed(2)).toBe('1000.00');

      const result = calculateInterestOnlySchedule({
        loanType: LoanType.INTEREST_ONLY,
        principalAmount: '100000',
        annualInterestRate: '12',
        interestCalculationMethod: InterestCalculationMethod.FLAT,
        termMonths: 12,
        startDate,
        firstDueDate,
        paymentFrequency: PaymentFrequency.MONTHLY
      });

      expect(result.principalAmount).toBe('100000.00');
      expect(result.totalInterest).toBe('12000.00');
      expect(result.totalPayable).toBe('112000.00');
      expect(result.schedule).toHaveLength(12);

      // Installment 1: opening 100k, interest 1k, principal 0, closing 100k
      expect(result.schedule[0].openingPrincipal).toBe('100000.00');
      expect(result.schedule[0].scheduledInterest).toBe('1000.00');
      expect(result.schedule[0].scheduledPrincipal).toBe('0.00');
      expect(result.schedule[0].scheduledAmount).toBe('1000.00');
      expect(result.schedule[0].closingPrincipal).toBe('100000.00');

      // Final installment 12: principal 100k returned
      expect(result.schedule[11].openingPrincipal).toBe('100000.00');
      expect(result.schedule[11].scheduledInterest).toBe('1000.00');
      expect(result.schedule[11].scheduledPrincipal).toBe('100000.00');
      expect(result.schedule[11].scheduledAmount).toBe('101000.00');
      expect(result.schedule[11].closingPrincipal).toBe('0.00');
    });
  });

  describe('Scenario B: Reducing-Balance EMI Loan', () => {
    it('calculates reducing balance EMI and verifies final closing principal is exactly 0.00', () => {
      const emi = calculateEMI(100000, 12, 12, PaymentFrequency.MONTHLY);
      // Standard EMI for 100k @ 12% for 12 months is ~8884.88
      expect(emi.toFixed(2)).toBe('8884.88');

      const result = calculateEMISchedule({
        loanType: LoanType.EMI,
        principalAmount: 100000,
        annualInterestRate: 12,
        interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
        termMonths: 12,
        startDate,
        firstDueDate,
        paymentFrequency: PaymentFrequency.MONTHLY
      });

      expect(result.schedule).toHaveLength(12);

      // Check sum of principal components matches principal
      let sumPrincipal = 0;
      let sumInterest = 0;
      for (const item of result.schedule) {
        sumPrincipal += parseFloat(item.scheduledPrincipal);
        sumInterest += parseFloat(item.scheduledInterest);
      }

      expect(sumPrincipal).toBeCloseTo(100000, 2);
      expect(result.schedule[11].closingPrincipal).toBe('0.00');
      expect(parseFloat(result.totalPayable)).toBeCloseTo(100000 + sumInterest, 2);
    });

    it('handles 0% interest rate gracefully without division by zero', () => {
      const result = calculateEMISchedule({
        loanType: LoanType.EMI,
        principalAmount: 120000,
        annualInterestRate: 0,
        interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
        termMonths: 12,
        startDate,
        firstDueDate,
        paymentFrequency: PaymentFrequency.MONTHLY
      });

      expect(result.totalInterest).toBe('0.00');
      expect(result.totalPayable).toBe('120000.00');
      expect(result.schedule[0].scheduledAmount).toBe('10000.00');
      expect(result.schedule[11].closingPrincipal).toBe('0.00');
    });
  });

  describe('Scenario C: Full Payment Loan', () => {
    it('calculates single maturity lump sum for ₹100,000 @ 12% p.a. for 6 months', () => {
      // Simple interest: 100000 * 12% * (6/12) = 6000
      const simpleInterest = calculateSimpleInterest(100000, 12, 6);
      expect(simpleInterest.toFixed(2)).toBe('6000.00');

      const result = calculateFullPaymentSchedule({
        loanType: LoanType.FULL_PAYMENT,
        principalAmount: 100000,
        annualInterestRate: 12,
        interestCalculationMethod: InterestCalculationMethod.FLAT,
        termMonths: 6,
        startDate,
        firstDueDate,
        paymentFrequency: PaymentFrequency.MONTHLY
      });

      expect(result.principalAmount).toBe('100000.00');
      expect(result.totalInterest).toBe('6000.00');
      expect(result.totalPayable).toBe('106000.00');
      expect(result.schedule).toHaveLength(1);
      expect(result.schedule[0].scheduledPrincipal).toBe('100000.00');
      expect(result.schedule[0].scheduledInterest).toBe('6000.00');
      expect(result.schedule[0].scheduledAmount).toBe('106000.00');
      expect(result.schedule[0].closingPrincipal).toBe('0.00');
    });
  });

  describe('Master dispatcher calculateLoanTotals', () => {
    it('dispatches to EMI schedule for LoanType.EMI', () => {
      const result = calculateLoanTotals({
        loanType: LoanType.EMI,
        principalAmount: 50000,
        annualInterestRate: 10,
        interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
        termMonths: 6,
        startDate,
        firstDueDate
      });
      expect(result.schedule).toHaveLength(6);
      expect(result.schedule[5].closingPrincipal).toBe('0.00');
    });
  });
});
