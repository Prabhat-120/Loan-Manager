import { z } from 'zod';
import {
  LoanType,
  InterestCalculationMethod,
  InterestRateType,
  PaymentFrequency,
  LoanStatus
} from './loan.types.js';

export const createLoanSchema = z
  .object({
    lenderPersonId: z.string().min(1, 'Lender is required'),
    borrowerPersonId: z.string().min(1, 'Borrower is required'),
    loanType: z.nativeEnum(LoanType, {
      errorMap: () => ({ message: 'Valid loan type is required (INTEREST_ONLY, EMI, FULL_PAYMENT)' })
    }),
    principalAmount: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = Number(val);
        return !isNaN(num) && num > 0;
      }, 'Principal amount must be a positive number')
      .transform((val) => Number(val).toFixed(2)),
    interestRate: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0;
      }, 'Interest rate must be non-negative')
      .transform((val) => Number(val).toFixed(2)),
    interestRateType: z
      .nativeEnum(InterestRateType)
      .default(InterestRateType.PERCENTAGE_PER_YEAR),
    interestCalculationMethod: z.nativeEnum(InterestCalculationMethod, {
      errorMap: () => ({ message: 'Valid interest calculation method is required (FLAT, REDUCING_BALANCE)' })
    }),
    termMonths: z.coerce.number().int().min(1, 'Term must be at least 1 month'),
    startDate: z.coerce.date({ invalid_type_error: 'Valid start date is required' }),
    firstDueDate: z.coerce.date({ invalid_type_error: 'Valid first due date is required' }),
    paymentFrequency: z
      .nativeEnum(PaymentFrequency)
      .default(PaymentFrequency.MONTHLY),
    notes: z.string().max(1000).optional()
  })
  .refine((data) => data.lenderPersonId !== data.borrowerPersonId, {
    message: 'Lender and Borrower cannot be the same Person',
    path: ['borrowerPersonId']
  })
  .refine((data) => data.firstDueDate >= data.startDate, {
    message: 'First due date cannot be before start date',
    path: ['firstDueDate']
  })
  .refine(
    (data) => {
      if (data.loanType === LoanType.EMI) {
        return data.interestCalculationMethod === InterestCalculationMethod.REDUCING_BALANCE;
      }
      return true;
    },
    {
      message: 'Reducing balance method is required for EMI loans',
      path: ['interestCalculationMethod']
    }
  );

export const updateDraftLoanSchema = z
  .object({
    lenderPersonId: z.string().min(1).optional(),
    borrowerPersonId: z.string().min(1).optional(),
    loanType: z.nativeEnum(LoanType).optional(),
    principalAmount: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = Number(val);
        return !isNaN(num) && num > 0;
      }, 'Principal amount must be a positive number')
      .transform((val) => Number(val).toFixed(2))
      .optional(),
    interestRate: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0;
      }, 'Interest rate must be non-negative')
      .transform((val) => Number(val).toFixed(2))
      .optional(),
    interestCalculationMethod: z.nativeEnum(InterestCalculationMethod).optional(),
    termMonths: z.coerce.number().int().min(1).optional(),
    startDate: z.coerce.date().optional(),
    firstDueDate: z.coerce.date().optional(),
    paymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
    notes: z.string().max(1000).optional()
  })
  .refine(
    (data) => {
      if (data.lenderPersonId && data.borrowerPersonId) {
        return data.lenderPersonId !== data.borrowerPersonId;
      }
      return true;
    },
    {
      message: 'Lender and Borrower cannot be the same Person',
      path: ['borrowerPersonId']
    }
  );

export const listLoansQuerySchema = z.object({
  search: z.string().optional(),
  loanNumber: z.string().optional(),
  lenderPersonId: z.string().optional(),
  borrowerPersonId: z.string().optional(),
  status: z.nativeEnum(LoanStatus).optional(),
  loanType: z.nativeEnum(LoanType).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const previewScheduleSchema = z
  .object({
    loanType: z.nativeEnum(LoanType),
    principalAmount: z.union([z.number(), z.string()]).transform((v) => Number(v)),
    annualInterestRate: z.union([z.number(), z.string()]).transform((v) => Number(v)),
    interestCalculationMethod: z.nativeEnum(InterestCalculationMethod),
    termMonths: z.coerce.number().int().min(1),
    startDate: z.coerce.date(),
    firstDueDate: z.coerce.date(),
    paymentFrequency: z.nativeEnum(PaymentFrequency).default(PaymentFrequency.MONTHLY)
  })
  .refine(
    (data) => {
      if (data.loanType === LoanType.EMI) {
        return data.interestCalculationMethod === InterestCalculationMethod.REDUCING_BALANCE;
      }
      return true;
    },
    {
      message: 'Reducing balance method is required for EMI loans',
      path: ['interestCalculationMethod']
    }
  );

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateDraftLoanInput = z.infer<typeof updateDraftLoanSchema>;
export type ListLoansQueryInput = z.infer<typeof listLoansQuerySchema>;
export type PreviewScheduleInput = z.infer<typeof previewScheduleSchema>;
