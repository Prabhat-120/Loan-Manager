import { Schema, model } from 'mongoose';
import { IPaymentScheduleAllocation } from './payment-schedule-allocation.types.js';

const paymentScheduleAllocationSchema = new Schema<IPaymentScheduleAllocation>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: 'RepaymentSchedule', required: true, index: true },
    installmentNumber: { type: Number, required: true },
    interestAmount: { type: Schema.Types.Decimal128, required: true },
    principalAmount: { type: Schema.Types.Decimal128, required: true },
    totalAmount: { type: Schema.Types.Decimal128, required: true }
  },
  {
    timestamps: true
  }
);

paymentScheduleAllocationSchema.index({ tenantId: 1, paymentId: 1 });
paymentScheduleAllocationSchema.index({ tenantId: 1, loanId: 1 });
paymentScheduleAllocationSchema.index({ tenantId: 1, scheduleId: 1 });

export const PaymentScheduleAllocationModel = model<IPaymentScheduleAllocation>(
  'PaymentScheduleAllocation',
  paymentScheduleAllocationSchema
);
