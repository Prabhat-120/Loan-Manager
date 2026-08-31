import { Document, Types } from 'mongoose';

export enum SubscriptionPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE'
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED'
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export interface ISubscriptionLimits {
  maxUsers: number;
  maxActiveLoans: number;
  maxPeople: number;
}

export interface ISubscription {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  startDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  limits: ISubscriptionLimits;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SubscriptionDocument = ISubscription & Document;
