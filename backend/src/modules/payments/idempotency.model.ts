import { Schema, model } from 'mongoose';
import { IIdempotencyKey } from './idempotency.types.js';

const idempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    key: { type: String, required: true, trim: true },
    requestHash: { type: String, required: true },
    responseStatus: { type: Number, required: true },
    responseBody: { type: Schema.Types.Mixed, required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

idempotencyKeySchema.index({ tenantId: 1, key: 1 }, { unique: true });
// Auto-expire keys after 24 hours
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const IdempotencyKeyModel = model<IIdempotencyKey>('IdempotencyKey', idempotencyKeySchema);
