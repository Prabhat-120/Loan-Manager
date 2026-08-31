import { Document, Types } from 'mongoose';

export interface IPaymentScheduleAllocation {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  paymentId: Types.ObjectId;
  loanId: Types.ObjectId;
  scheduleId: Types.ObjectId;
  installmentNumber: number;
  interestAmount: Types.Decimal128;
  principalAmount: Types.Decimal128;
  totalAmount: Types.Decimal128;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentScheduleAllocationDocument = IPaymentScheduleAllocation & Document;
