import { Document, Types } from 'mongoose';

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
  openingPrincipal: Types.Decimal128;
  scheduledPrincipal: Types.Decimal128;
  scheduledInterest: Types.Decimal128;
  scheduledAmount: Types.Decimal128;
  paidPrincipal: Types.Decimal128;
  paidInterest: Types.Decimal128;
  paidAmount: Types.Decimal128;
  remainingAmount: Types.Decimal128;
  status: ScheduleStatus;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RepaymentScheduleDocument = IRepaymentSchedule & Document;
