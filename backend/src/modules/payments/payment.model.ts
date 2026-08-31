import { Schema, model } from 'mongoose';
import { IPayment, PaymentMethod, PaymentStatus } from './payment.types.js';
import { toDecimal128 } from '../../common/utils/money.js';

const paymentSchema = new Schema<IPayment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: 'RepaymentSchedule', index: true },
    paymentNumber: { type: String, required: true, uppercase: true, trim: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    principalComponent: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    interestComponent: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    penaltyComponent: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    paymentDate: { type: Date, required: true, default: Date.now },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    referenceNumber: { type: String, trim: true },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.COMPLETED },
    notes: { type: String, trim: true },
    recordedById: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ tenantId: 1, paymentNumber: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, loanId: 1, paymentDate: -1 });

export const PaymentModel = model<IPayment>('Payment', paymentSchema);
