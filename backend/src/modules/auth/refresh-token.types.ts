import { Document, Types } from 'mongoose';

export interface IRefreshToken {
  _id?: Types.ObjectId;
  tenantId?: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenId?: Types.ObjectId;
  deviceInfo?: string;
  createdAt?: Date;
}

export type RefreshTokenDocument = IRefreshToken & Document;
