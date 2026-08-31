import { Schema, model } from 'mongoose';
import { ISubscription, SubscriptionPlan, SubscriptionStatus } from './subscription.types.js';

const subscriptionSchema = new Schema<ISubscription>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    plan: { type: String, enum: Object.values(SubscriptionPlan), default: SubscriptionPlan.STARTER },
    status: { type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.ACTIVE },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    cancelAtPeriodEnd: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

subscriptionSchema.index({ tenantId: 1, status: 1 });

export const SubscriptionModel = model<ISubscription>('Subscription', subscriptionSchema);
