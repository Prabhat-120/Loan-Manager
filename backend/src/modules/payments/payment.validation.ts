import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from './payment.types.js';

export const createPaymentSchema = z.object({
  loanId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid loan ID'),
  amount: z.coerce
    .number()
    .positive('Payment amount must be greater than zero')
    .max(1000000000, 'Payment amount exceeds maximum limit')
    .refine((val) => !isNaN(val) && isFinite(val), 'Payment amount must be a valid finite number'),
  paymentDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid payment date'
  }),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method' })
  }),
  referenceNumber: z.string().max(100, 'Reference number too long').optional(),
  notes: z.string().max(1000, 'Notes too long').optional()
});

export const previewPaymentSchema = z.object({
  loanId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid loan ID'),
  amount: z.coerce
    .number()
    .positive('Payment amount must be greater than zero')
    .max(1000000000, 'Payment amount exceeds maximum limit')
    .refine((val) => !isNaN(val) && isFinite(val), 'Payment amount must be a valid finite number'),
  paymentDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid payment date'
  })
});

export const reversePaymentSchema = z.object({
  reason: z.string().min(3, 'Reversal reason must be at least 3 characters').max(500, 'Reversal reason too long')
});

export const listPaymentsQuerySchema = z.object({
  loanId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  borrowerPersonId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  referenceNumber: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['paymentDate', 'amount', 'createdAt', 'paymentNumber']).default('paymentDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PreviewPaymentInput = z.infer<typeof previewPaymentSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
export type ListPaymentsQueryInput = z.infer<typeof listPaymentsQuerySchema>;
