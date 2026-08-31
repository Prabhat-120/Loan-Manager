import { Document, Types } from 'mongoose';

export interface IIdempotencyKey {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody: any;
  paymentId?: Types.ObjectId;
  createdAt?: Date;
}

export type IdempotencyKeyDocument = IIdempotencyKey & Document;
