import { Document, Types } from 'mongoose';

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  OTHER = 'OTHER'
}

export enum PaymentStatus {
  POSTED = 'POSTED',
  REVERSED = 'REVERSED'
}

export interface IPayment {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  paymentNumber: string;
  loanId: Types.ObjectId;
  borrowerPersonId: Types.ObjectId;
  amount: Types.Decimal128;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  status: PaymentStatus;
  allocatedInterest: Types.Decimal128;
  allocatedPrincipal: Types.Decimal128;
  unallocatedAmount: Types.Decimal128;
  createdBy: Types.ObjectId;
  reversedBy?: Types.ObjectId;
  reversedAt?: Date;
  reversalReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentDocument = IPayment & Document;
