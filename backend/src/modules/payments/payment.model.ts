import { Schema, model } from 'mongoose';
import { IPayment, PaymentMethod, PaymentStatus } from './payment.types.js';
import { toDecimal128 } from '../../common/utils/money.js';

const paymentSchema = new Schema<IPayment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    paymentNumber: { type: String, required: true, uppercase: true, trim: true },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    borrowerPersonId: { type: Schema.Types.ObjectId, ref: 'Person', required: true, index: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    paymentDate: { type: Date, required: true, default: Date.now },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    referenceNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.POSTED, required: true, index: true },
    allocatedInterest: { type: Schema.Types.Decimal128, default: () => toDecimal128(0), required: true },
    allocatedPrincipal: { type: Schema.Types.Decimal128, default: () => toDecimal128(0), required: true },
    unallocatedAmount: { type: Schema.Types.Decimal128, default: () => toDecimal128(0), required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reversedAt: { type: Date },
    reversalReason: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ tenantId: 1, paymentNumber: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, loanId: 1, paymentDate: -1 });
paymentSchema.index({ tenantId: 1, borrowerPersonId: 1, paymentDate: -1 });
paymentSchema.index({ tenantId: 1, status: 1, paymentDate: -1 });

export const PaymentModel = model<IPayment>('Payment', paymentSchema);
