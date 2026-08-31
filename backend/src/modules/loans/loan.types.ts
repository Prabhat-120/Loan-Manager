import { Document, Types } from 'mongoose';

export enum LoanType {
  INTEREST_ONLY = 'INTEREST_ONLY',
  EMI = 'EMI',
  FULL_PAYMENT = 'FULL_PAYMENT'
}

export enum InterestCalculationMethod {
  FLAT = 'FLAT',
  REDUCING_BALANCE = 'REDUCING_BALANCE'
}

export enum InterestRateType {
  PERCENTAGE_PER_YEAR = 'PERCENTAGE_PER_YEAR'
}

export enum PaymentFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY'
}

export enum LoanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  OVERDUE = 'OVERDUE',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED'
}

export interface ILoan {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  loanNumber: string;
  lenderPersonId: Types.ObjectId;
  borrowerPersonId: Types.ObjectId;
  loanType: LoanType;
  principalAmount: Types.Decimal128;
  interestRate: Types.Decimal128;
  interestRateType: InterestRateType;
  interestCalculationMethod: InterestCalculationMethod;
  termMonths: number;
  startDate: Date;
  firstDueDate: Date;
  maturityDate?: Date;
  paymentFrequency: PaymentFrequency;
  status: LoanStatus;
  totalInterest: Types.Decimal128;
  totalPayable: Types.Decimal128;
  totalPaid: Types.Decimal128;
  outstandingPrincipal: Types.Decimal128;
  outstandingInterest: Types.Decimal128;
  notes?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LoanDocument = ILoan & Document;
