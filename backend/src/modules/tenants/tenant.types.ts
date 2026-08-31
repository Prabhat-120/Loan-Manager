import { Document, Types } from 'mongoose';

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED'
}

export interface ITenantSettings {
  loanNumberPrefix?: string;
  dateFormat?: string;
  autoEmailReminders?: boolean;
}

export interface ITenant {
  _id?: Types.ObjectId;
  name: string;
  slug: string;
  domain?: string;
  status: TenantStatus;
  currency: string;
  timezone: string;
  settings?: ITenantSettings;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TenantDocument = ITenant & Document;
