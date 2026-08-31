import { Document, Types } from 'mongoose';

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE'
}

export interface ITenantAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
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
  contactEmail?: string;
  contactPhone?: string;
  address?: ITenantAddress;
  country?: string;
  settings?: ITenantSettings;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TenantDocument = ITenant & Document;
