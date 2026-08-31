import { Document, Types } from 'mongoose';

export enum UserRole {
  PLATFORM_OWNER = 'PLATFORM_OWNER',
  TENANT_OWNER = 'TENANT_OWNER',
  TENANT_ADMIN = 'TENANT_ADMIN',
  LOAN_OFFICER = 'LOAN_OFFICER',
  READ_ONLY = 'READ_ONLY'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  BLOCKED = 'BLOCKED'
}

export interface IUser {
  _id?: Types.ObjectId;
  tenantId?: Types.ObjectId;
  personId?: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserDocument = IUser & Document;
