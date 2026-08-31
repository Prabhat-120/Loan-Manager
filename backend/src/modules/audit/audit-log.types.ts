import { Document, Types } from 'mongoose';

export enum AuditScope {
  PLATFORM = 'PLATFORM',
  TENANT = 'TENANT'
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  STATUS_CHANGE = 'STATUS_CHANGE'
}

export interface IAuditLog {
  _id?: Types.ObjectId;
  scope: AuditScope;
  tenantId?: Types.ObjectId;
  userId?: Types.ObjectId;
  action: AuditAction;
  entity: string;
  entityId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

export type AuditLogDocument = IAuditLog & Document;
