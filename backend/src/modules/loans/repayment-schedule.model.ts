import { Schema, model } from 'mongoose';
import { IRepaymentSchedule, ScheduleStatus } from './repayment-schedule.types.js';
import { toDecimal128 } from '../../common/utils/money.js';

const repaymentScheduleSchema = new Schema<IRepaymentSchedule>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    installmentNumber: { type: Number, required: true, min: 1 },
    dueDate: { type: Date, required: true, index: true },
    openingPrincipal: { type: Schema.Types.Decimal128, required: true },
    scheduledPrincipal: { type: Schema.Types.Decimal128, required: true },
    scheduledInterest: { type: Schema.Types.Decimal128, required: true },
    scheduledAmount: { type: Schema.Types.Decimal128, required: true },
    paidPrincipal: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    paidInterest: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    paidAmount: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    remainingAmount: { type: Schema.Types.Decimal128, required: true },
    status: {
      type: String,
      enum: Object.values(ScheduleStatus),
      default: ScheduleStatus.PENDING,
      index: true
    },
    paidAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Indexes
repaymentScheduleSchema.index(
  { tenantId: 1, loanId: 1, installmentNumber: 1 },
  { unique: true }
);
repaymentScheduleSchema.index({ tenantId: 1, loanId: 1, dueDate: 1 });
repaymentScheduleSchema.index({ tenantId: 1, status: 1 });

export const RepaymentScheduleModel = model<IRepaymentSchedule>(
  'RepaymentSchedule',
  repaymentScheduleSchema
);
