import { Schema, model } from 'mongoose';
import { ITenant, TenantStatus } from './tenant.types.js';

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    domain: { type: String, lowercase: true, trim: true },
    status: { type: String, enum: Object.values(TenantStatus), default: TenantStatus.ACTIVE, index: true },
    currency: { type: String, required: true, uppercase: true, default: 'INR' },
    timezone: { type: String, required: true, default: 'Asia/Kolkata' },
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'IN' }
    },
    country: { type: String, default: 'IN' },
    settings: {
      loanNumberPrefix: { type: String, default: 'LN' },
      dateFormat: { type: String, default: 'YYYY-MM-DD' },
      autoEmailReminders: { type: Boolean, default: true }
    }
  },
  {
    timestamps: true
  }
);

export const TenantModel = model<ITenant>('Tenant', tenantSchema);
