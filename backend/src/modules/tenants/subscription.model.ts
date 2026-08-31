import { Schema, model } from 'mongoose';
import {
  ISubscription,
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle
} from './subscription.types.js';

const subscriptionSchema = new Schema<ISubscription>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    plan: { type: String, enum: Object.values(SubscriptionPlan), default: SubscriptionPlan.STARTER },
    status: { type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.ACTIVE, index: true },
    billingCycle: { type: String, enum: Object.values(BillingCycle), default: BillingCycle.MONTHLY },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    startDate: { type: Date, required: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true, index: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    limits: {
      maxUsers: { type: Number, default: 5 },
      maxActiveLoans: { type: Number, default: 50 },
      maxPeople: { type: Number, default: 200 }
    }
  },
  {
    timestamps: true
  }
);

subscriptionSchema.index({ tenantId: 1, status: 1 });

export const SubscriptionModel = model<ISubscription>('Subscription', subscriptionSchema);
