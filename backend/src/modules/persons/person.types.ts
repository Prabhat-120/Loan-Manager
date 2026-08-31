import { Document, Types } from 'mongoose';

export enum PersonType {
  INDIVIDUAL = 'INDIVIDUAL',
  ORGANIZATION = 'ORGANIZATION'
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
  lastName?: string;
  organizationName?: string;
  email?: string;
  phone: string;
  normalizedPhone: string;
  idType?: PersonIdType;
  idNumber?: string;
  address?: IPersonAddress;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PersonDocument = IPerson & Document;
