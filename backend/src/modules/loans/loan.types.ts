import { Document, Types } from 'mongoose';

export enum PaymentType {
  EMI = 'EMI',
  INTEREST_ONLY = 'INTEREST_ONLY',
  BULLET = 'BULLET',
  CUSTOM = 'CUSTOM'
}

export enum InterestType {
  SIMPLE = 'SIMPLE',
  FLAT_RATE = 'FLAT_RATE',
  REDUCING_BALANCE = 'REDUCING_BALANCE',
  COMPOUND = 'COMPOUND'
}

export enum TermUnit {
  DAYS = 'DAYS',
  WEEKS = 'WEEKS',
  MONTHS = 'MONTHS',
  YEARS = 'YEARS'
}

export enum RepaymentFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY'
}

export enum DayCountConvention {
  ACTUAL_365 = 'ACTUAL_365',
  ACTUAL_360 = 'ACTUAL_360',
  THIRTY_360 = 'THIRTY_360'
}

export enum LoanStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  DISBURSED = 'DISBURSED',
  ACTIVE = 'ACTIVE',
  PAID_OFF = 'PAID_OFF',
  DEFAULTED = 'DEFAULTED',
  CANCELLED = 'CANCELLED'
}

export interface ILoan {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  loanNumber: string;
  borrowerId: Types.ObjectId;
  lenderId: Types.ObjectId;
  currency: string;
  principalAmount: Types.Decimal128;
  interestRate: Types.Decimal128;
  paymentType: PaymentType;
  interestType: InterestType;
  termValue: number;
  termUnit: TermUnit;
  repaymentFrequency: RepaymentFrequency;
  dayCountConvention: DayCountConvention;
  status: LoanStatus;
  disbursedAt?: Date;
  firstDueDate?: Date;
  maturityDate?: Date;
  totalPrincipalPaid: Types.Decimal128;
  totalInterestPaid: Types.Decimal128;
  outstandingBalance: Types.Decimal128;
  createdById: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LoanDocument = ILoan & Document;
