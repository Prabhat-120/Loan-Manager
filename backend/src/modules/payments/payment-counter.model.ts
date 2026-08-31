import { Schema, model, Document, Types } from 'mongoose';

export interface IPaymentCounter {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  year: number;
  seq: number;
}

export type PaymentCounterDocument = IPaymentCounter & Document;

const paymentCounterSchema = new Schema<IPaymentCounter>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0 }
  },
  {
    timestamps: true
  }
);

paymentCounterSchema.index({ tenantId: 1, year: 1 }, { unique: true });

export const PaymentCounterModel = model<IPaymentCounter>('PaymentCounter', paymentCounterSchema);

/**
 * Atomically generate a unique, sequential payment number for a tenant
 * Format: PMT-YYYY-XXXXXX (e.g. PMT-2026-000001)
 */
export async function getNextPaymentNumber(
  tenantId: Types.ObjectId | string,
  session?: any
): Promise<string> {
  const year = new Date().getFullYear();
  const options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    ...(session ? { session } : {})
  };

  const counter = await PaymentCounterModel.findOneAndUpdate(
    { tenantId, year },
    { $inc: { seq: 1 } },
    options
  );

  const seqNumber = counter ? counter.seq : 1;
  const paddedSeq = seqNumber.toString().padStart(6, '0');
  return `PMT-${year}-${paddedSeq}`;
}
