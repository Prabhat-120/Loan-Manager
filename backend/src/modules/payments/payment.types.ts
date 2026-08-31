import { Document, Types } from 'mongoose';

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  CARD = 'CARD',
  OTHER = 'OTHER'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export interface IPayment {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  loanId: Types.ObjectId;
  scheduleId?: Types.ObjectId;
  paymentNumber: string;
  amount: Types.Decimal128;
  principalComponent: Types.Decimal128;
  interestComponent: Types.Decimal128;
  penaltyComponent: Types.Decimal128;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  status: PaymentStatus;
  notes?: string;
  recordedById: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentDocument = IPayment & Document;
