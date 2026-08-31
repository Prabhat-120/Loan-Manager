import Decimal from 'decimal.js';

// Configure Decimal.js precision for financial calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export enum LoanType {
  INTEREST_ONLY = 'INTEREST_ONLY',
  EMI = 'EMI',
  FULL_PAYMENT = 'FULL_PAYMENT'
}

export enum InterestCalculationMethod {
  FLAT = 'FLAT',
  REDUCING_BALANCE = 'REDUCING_BALANCE'
}

export enum PaymentFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY'
}

export interface ScheduleItemResult {
  installmentNumber: number;
  dueDate: Date;
  openingPrincipal: string;
  scheduledPrincipal: string;
  scheduledInterest: string;
  scheduledAmount: string;
  closingPrincipal: string;
}

export interface LoanTotalsResult {
  principalAmount: string;
  totalInterest: string;
  totalPayable: string;
  monthlyEMI?: string;
  schedule: ScheduleItemResult[];
}

export interface CalculationInput {
  loanType: LoanType;
  principalAmount: string | number;
  annualInterestRate: string | number; // in percentage, e.g. 12 for 12%
  interestCalculationMethod: InterestCalculationMethod;
  termMonths: number;
  startDate: Date;
  firstDueDate: Date;
  paymentFrequency?: PaymentFrequency;
}

/**
 * Returns periods per year based on frequency
 */
export function getPeriodsPerYear(frequency: PaymentFrequency = PaymentFrequency.MONTHLY): number {
  switch (frequency) {
    case PaymentFrequency.QUARTERLY:
      return 4;
    case PaymentFrequency.ANNUALLY:
      return 1;
    case PaymentFrequency.MONTHLY:
    default:
      return 12;
  }
}

/**
 * Calculate simple interest: I = P * r * (termMonths / 12)
 */
export function calculateSimpleInterest(
  principal: string | number,
  annualRatePct: string | number,
  termMonths: number
): Decimal {
  const p = new Decimal(principal);
  const r = new Decimal(annualRatePct).div(100);
  const t = new Decimal(termMonths).div(12);
  return p.times(r).times(t).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Calculate periodic interest on an outstanding principal
 */
export function calculatePeriodicInterest(
  principal: string | number,
  annualRatePct: string | number,
  frequency: PaymentFrequency = PaymentFrequency.MONTHLY
): Decimal {
  const p = new Decimal(principal);
  const periodsPerYear = getPeriodsPerYear(frequency);
  const periodicRate = new Decimal(annualRatePct).div(100).div(periodsPerYear);
  return p.times(periodicRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Calculate EMI using standard reducing balance formula:
 * EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 */
export function calculateEMI(
  principal: string | number,
  annualRatePct: string | number,
  termMonths: number,
  frequency: PaymentFrequency = PaymentFrequency.MONTHLY
): Decimal {
  const p = new Decimal(principal);
  const periodsPerYear = getPeriodsPerYear(frequency);
  const totalInstallments = Math.round((termMonths / 12) * periodsPerYear);

  if (totalInstallments <= 0) {
    throw new Error('Total installments must be greater than zero');
  }

  const annualRate = new Decimal(annualRatePct);
  if (annualRate.isZero()) {
    // 0% interest -> EMI is simply principal / installments
    return p.div(totalInstallments).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  const r = annualRate.div(100).div(periodsPerYear);
  const onePlusRPowN = new Decimal(1).plus(r).pow(totalInstallments);
  const numerator = p.times(r).times(onePlusRPowN);
  const denominator = onePlusRPowN.minus(1);

  return numerator.div(denominator).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Calculate next due date given firstDueDate and installment index (0-indexed)
 */
export function computeInstallmentDueDate(
  firstDueDate: Date,
  installmentIndex: number,
  frequency: PaymentFrequency = PaymentFrequency.MONTHLY
): Date {
  const date = new Date(firstDueDate);
  const stepMonths = frequency === PaymentFrequency.QUARTERLY ? 3 : frequency === PaymentFrequency.ANNUALLY ? 12 : 1;
  const targetMonth = date.getMonth() + installmentIndex * stepMonths;
  date.setMonth(targetMonth);
  return date;
}

/**
 * Generate full reducing-balance EMI schedule with final installment exact rounding correction
 */
export function calculateEMISchedule(input: CalculationInput): LoanTotalsResult {
  const p = new Decimal(input.principalAmount);
  const freq = input.paymentFrequency || PaymentFrequency.MONTHLY;
  const periodsPerYear = getPeriodsPerYear(freq);
  const totalInstallments = Math.round((input.termMonths / 12) * periodsPerYear);

  const emiAmount = calculateEMI(input.principalAmount, input.annualInterestRate, input.termMonths, freq);
  const periodicRate = new Decimal(input.annualInterestRate).div(100).div(periodsPerYear);

  let currentOpening = p;
  let totalInterestAccum = new Decimal(0);
  let totalPrincipalAccum = new Decimal(0);
  const schedule: ScheduleItemResult[] = [];

  for (let i = 1; i <= totalInstallments; i++) {
    const dueDate = computeInstallmentDueDate(input.firstDueDate, i - 1, freq);

    let interestPart: Decimal;
    let principalPart: Decimal;
    let closingPrincipal: Decimal;
    let scheduledAmount: Decimal;

    if (i === totalInstallments) {
      // Final installment: exactly pay off remaining principal
      principalPart = currentOpening;
      interestPart = currentOpening.times(periodicRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      scheduledAmount = principalPart.plus(interestPart).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      closingPrincipal = new Decimal(0);
    } else {
      interestPart = currentOpening.times(periodicRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      principalPart = emiAmount.minus(interestPart).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Guard against negative principal payment
      if (principalPart.isNegative()) {
        principalPart = new Decimal(0);
      }

      scheduledAmount = emiAmount;
      closingPrincipal = currentOpening.minus(principalPart).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    totalInterestAccum = totalInterestAccum.plus(interestPart);
    totalPrincipalAccum = totalPrincipalAccum.plus(principalPart);

    schedule.push({
      installmentNumber: i,
      dueDate,
      openingPrincipal: currentOpening.toFixed(2),
      scheduledPrincipal: principalPart.toFixed(2),
      scheduledInterest: interestPart.toFixed(2),
      scheduledAmount: scheduledAmount.toFixed(2),
      closingPrincipal: closingPrincipal.toFixed(2)
    });

    currentOpening = closingPrincipal;
  }

  const totalPayable = totalPrincipalAccum.plus(totalInterestAccum);

  return {
    principalAmount: p.toFixed(2),
    totalInterest: totalInterestAccum.toFixed(2),
    totalPayable: totalPayable.toFixed(2),
    monthlyEMI: emiAmount.toFixed(2),
    schedule
  };
}

/**
 * Generate Interest-Only schedule: Periodic interest installments + full principal in final installment
 */
export function calculateInterestOnlySchedule(input: CalculationInput): LoanTotalsResult {
  const p = new Decimal(input.principalAmount);
  const freq = input.paymentFrequency || PaymentFrequency.MONTHLY;
  const periodsPerYear = getPeriodsPerYear(freq);
  const totalInstallments = Math.max(1, Math.round((input.termMonths / 12) * periodsPerYear));
  const periodicInterest = calculatePeriodicInterest(input.principalAmount, input.annualInterestRate, freq);

  let totalInterestAccum = new Decimal(0);
  const schedule: ScheduleItemResult[] = [];

  for (let i = 1; i <= totalInstallments; i++) {
    const dueDate = computeInstallmentDueDate(input.firstDueDate, i - 1, freq);
    const isFinal = i === totalInstallments;

    const principalPart = isFinal ? p : new Decimal(0);
    const interestPart = periodicInterest;
    const scheduledAmount = principalPart.plus(interestPart).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const closingPrincipal = isFinal ? new Decimal(0) : p;

    totalInterestAccum = totalInterestAccum.plus(interestPart);

    schedule.push({
      installmentNumber: i,
      dueDate,
      openingPrincipal: p.toFixed(2),
      scheduledPrincipal: principalPart.toFixed(2),
      scheduledInterest: interestPart.toFixed(2),
      scheduledAmount: scheduledAmount.toFixed(2),
      closingPrincipal: closingPrincipal.toFixed(2)
    });
  }

  const totalPayable = p.plus(totalInterestAccum);

  return {
    principalAmount: p.toFixed(2),
    totalInterest: totalInterestAccum.toFixed(2),
    totalPayable: totalPayable.toFixed(2),
    schedule
  };
}

/**
 * Generate Full-Payment schedule: Single installment at maturity
 */
export function calculateFullPaymentSchedule(input: CalculationInput): LoanTotalsResult {
  const p = new Decimal(input.principalAmount);
  const totalInterest = calculateSimpleInterest(input.principalAmount, input.annualInterestRate, input.termMonths);
  const totalPayable = p.plus(totalInterest);

  const maturityDate = computeInstallmentDueDate(input.firstDueDate, Math.max(0, input.termMonths - 1), PaymentFrequency.MONTHLY);

  const schedule: ScheduleItemResult[] = [
    {
      installmentNumber: 1,
      dueDate: maturityDate,
      openingPrincipal: p.toFixed(2),
      scheduledPrincipal: p.toFixed(2),
      scheduledInterest: totalInterest.toFixed(2),
      scheduledAmount: totalPayable.toFixed(2),
      closingPrincipal: '0.00'
    }
  ];

  return {
    principalAmount: p.toFixed(2),
    totalInterest: totalInterest.toFixed(2),
    totalPayable: totalPayable.toFixed(2),
    schedule
  };
}

/**
 * Master loan totals and schedule dispatcher
 */
export function calculateLoanTotals(input: CalculationInput): LoanTotalsResult {
  switch (input.loanType) {
    case LoanType.EMI:
      return calculateEMISchedule(input);
    case LoanType.INTEREST_ONLY:
      return calculateInterestOnlySchedule(input);
    case LoanType.FULL_PAYMENT:
      return calculateFullPaymentSchedule(input);
    default:
      throw new Error(`Unsupported loan type: ${input.loanType}`);
  }
}
