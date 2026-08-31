import { Document, Types } from 'mongoose';

export enum PersonType {
  INDIVIDUAL = 'INDIVIDUAL',
  ORGANIZATION = 'ORGANIZATION'
}

export enum PersonStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

export enum PersonIdType {
  NATIONAL_ID = 'NATIONAL_ID',
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  TAX_ID = 'TAX_ID',
  OTHER = 'OTHER'
}

export interface IPersonAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface IPerson {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId?: Types.ObjectId;
  type: PersonType;
  displayName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  organizationName?: string;
  email?: string;
  phone: string;
  normalizedPhone: string;
  alternatePhone?: string;
  idType?: PersonIdType;
  idNumber?: string;
  address?: IPersonAddress;
  dateOfBirth?: Date;
  occupation?: string;
  notes?: string;
  status: PersonStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PersonDocument = IPerson & Document;
