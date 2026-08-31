import { Schema, model, Document, Types } from 'mongoose';

export interface ILoanCounter {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  year: number;
  seq: number;
}

export type LoanCounterDocument = ILoanCounter & Document;

const loanCounterSchema = new Schema<ILoanCounter>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0 }
  },
  {
    timestamps: true
  }
);

loanCounterSchema.index({ tenantId: 1, year: 1 }, { unique: true });

export const LoanCounterModel = model<ILoanCounter>('LoanCounter', loanCounterSchema);

/**
 * Atomically generate a unique, sequential loan number for a tenant
 * Format: LN-YYYY-XXXXXX (e.g. LN-2026-000001)
 */
export async function getNextLoanNumber(
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

  const counter = await LoanCounterModel.findOneAndUpdate(
    { tenantId, year },
    { $inc: { seq: 1 } },
    options
  );

  const seqNumber = counter ? counter.seq : 1;
  const paddedSeq = seqNumber.toString().padStart(6, '0');
  return `LN-${year}-${paddedSeq}`;
}
