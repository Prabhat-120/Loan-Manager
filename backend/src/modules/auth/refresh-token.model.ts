import { Schema, model } from 'mongoose';
import { IRefreshToken } from './refresh-token.types.js';

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
    deviceInfo: { type: String }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// TTL index to automatically purge expired tokens from MongoDB
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
