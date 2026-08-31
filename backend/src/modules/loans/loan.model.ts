import { Schema, model } from 'mongoose';
import {
  ILoan,
  LoanStatus,
  LoanType,
  InterestCalculationMethod,
  InterestRateType,
  PaymentFrequency
} from './loan.types.js';
import { toDecimal128 } from '../../common/utils/money.js';

const loanSchema = new Schema<ILoan>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    loanNumber: { type: String, required: true, uppercase: true, trim: true },
    lenderPersonId: { type: Schema.Types.ObjectId, ref: 'Person', required: true, index: true },
    borrowerPersonId: {
      type: Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
      validate: {
        validator: function (this: ILoan, value: Schema.Types.ObjectId) {
          return !this.lenderPersonId || value.toString() !== this.lenderPersonId.toString();
        },
        message: 'Lender and Borrower cannot be the same Person'
      }
    },
    loanType: { type: String, enum: Object.values(LoanType), required: true },
    principalAmount: { type: Schema.Types.Decimal128, required: true },
    interestRate: { type: Schema.Types.Decimal128, required: true },
    interestRateType: {
      type: String,
      enum: Object.values(InterestRateType),
      default: InterestRateType.PERCENTAGE_PER_YEAR,
      required: true
    },
    interestCalculationMethod: {
      type: String,
      enum: Object.values(InterestCalculationMethod),
      required: true
    },
    termMonths: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    firstDueDate: { type: Date, required: true },
    maturityDate: { type: Date },
    paymentFrequency: {
      type: String,
      enum: Object.values(PaymentFrequency),
      default: PaymentFrequency.MONTHLY,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(LoanStatus),
      default: LoanStatus.DRAFT,
      index: true
    },
    totalInterest: { type: Schema.Types.Decimal128, required: true, default: () => toDecimal128(0) },
    totalPayable: { type: Schema.Types.Decimal128, required: true, default: () => toDecimal128(0) },
    totalPaid: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    outstandingPrincipal: { type: Schema.Types.Decimal128, required: true, default: () => toDecimal128(0) },
    outstandingInterest: { type: Schema.Types.Decimal128, required: true, default: () => toDecimal128(0) },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true
  }
);

// Indexes
loanSchema.index({ tenantId: 1, loanNumber: 1 }, { unique: true });
loanSchema.index({ tenantId: 1, status: 1 });
loanSchema.index({ tenantId: 1, lenderPersonId: 1 });
loanSchema.index({ tenantId: 1, borrowerPersonId: 1 });
loanSchema.index({ tenantId: 1, createdAt: -1 });

export const LoanModel = model<ILoan>('Loan', loanSchema);
