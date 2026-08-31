import { Document, Types } from 'mongoose';

export interface IRefreshToken {
  _id?: Types.ObjectId;
  tenantId?: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
  deviceInfo?: string;
  createdAt?: Date;
}

export type RefreshTokenDocument = IRefreshToken & Document;
