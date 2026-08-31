import { Schema, model } from 'mongoose';
import {
  ILoan,
  LoanStatus,
  PaymentType,
  InterestType,
  TermUnit,
  RepaymentFrequency,
  DayCountConvention
} from './loan.types.js';
import { toDecimal128 } from '../../common/utils/money.js';

const loanSchema = new Schema<ILoan>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    loanNumber: { type: String, required: true, uppercase: true, trim: true },
    borrowerId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    lenderId: {
      type: Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      validate: {
        validator: function (this: ILoan, value: Schema.Types.ObjectId) {
          return !this.borrowerId || value.toString() !== this.borrowerId.toString();
        },
        message: 'Lender and Borrower cannot be the same Person'
      }
    },
    currency: { type: String, required: true, uppercase: true, default: 'INR' },
    principalAmount: { type: Schema.Types.Decimal128, required: true },
    interestRate: { type: Schema.Types.Decimal128, required: true },
    paymentType: { type: String, enum: Object.values(PaymentType), default: PaymentType.EMI, required: true },
    interestType: { type: String, enum: Object.values(InterestType), default: InterestType.REDUCING_BALANCE, required: true },
    termValue: { type: Number, required: true, min: 1 },
    termUnit: { type: String, enum: Object.values(TermUnit), default: TermUnit.MONTHS, required: true },
    repaymentFrequency: { type: String, enum: Object.values(RepaymentFrequency), default: RepaymentFrequency.MONTHLY, required: true },
    dayCountConvention: { type: String, enum: Object.values(DayCountConvention), default: DayCountConvention.ACTUAL_365 },
    status: { type: String, enum: Object.values(LoanStatus), default: LoanStatus.DRAFT },
    disbursedAt: { type: Date },
    firstDueDate: { type: Date },
    maturityDate: { type: Date },
    totalPrincipalPaid: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    totalInterestPaid: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    outstandingBalance: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true
  }
);

// Indexes
loanSchema.index({ tenantId: 1, loanNumber: 1 }, { unique: true });
loanSchema.index({ tenantId: 1, status: 1 });
loanSchema.index({ tenantId: 1, borrowerId: 1 });
loanSchema.index({ tenantId: 1, lenderId: 1 });

export const LoanModel = model<ILoan>('Loan', loanSchema);
