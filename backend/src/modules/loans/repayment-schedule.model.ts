import { Schema, model, Document, Types } from 'mongoose';
import { toDecimal128 } from '../../common/utils/money.js';

export enum ScheduleStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE'
}

export interface IRepaymentSchedule {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  loanId: Types.ObjectId;
  installmentNumber: number;
  dueDate: Date;
  principalAmount: Types.Decimal128;
  interestAmount: Types.Decimal128;
  totalAmount: Types.Decimal128;
  paidAmount: Types.Decimal128;
  status: ScheduleStatus;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RepaymentScheduleDocument = IRepaymentSchedule & Document;

const repaymentScheduleSchema = new Schema<IRepaymentSchedule>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    installmentNumber: { type: Number, required: true, min: 1 },
    dueDate: { type: Date, required: true },
    principalAmount: { type: Schema.Types.Decimal128, required: true },
    interestAmount: { type: Schema.Types.Decimal128, required: true },
    totalAmount: { type: Schema.Types.Decimal128, required: true },
    paidAmount: { type: Schema.Types.Decimal128, default: () => toDecimal128(0) },
    status: { type: String, enum: Object.values(ScheduleStatus), default: ScheduleStatus.PENDING },
    paidAt: { type: Date }
  },
  {
    timestamps: true
  }
);

repaymentScheduleSchema.index(
  { tenantId: 1, loanId: 1, installmentNumber: 1 },
  { unique: true }
);
repaymentScheduleSchema.index({ tenantId: 1, loanId: 1, status: 1, dueDate: 1 });

export const RepaymentScheduleModel = model<IRepaymentSchedule>(
  'RepaymentSchedule',
  repaymentScheduleSchema
);
