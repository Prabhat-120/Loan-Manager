import { Schema, model } from 'mongoose';
import { IPerson, PersonType, PersonIdType } from './person.types.js';
import { normalizePhone } from '../../common/utils/phone.js';

const personSchema = new Schema<IPerson>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: Object.values(PersonType), default: PersonType.INDIVIDUAL },
    displayName: { type: String, required: true, trim: true },
    firstName: {
      type: String,
      trim: true,
      required: function (this: IPerson) {
        return this.type === PersonType.INDIVIDUAL;
      }
    },
    lastName: {
      type: String,
      trim: true,
      required: function (this: IPerson) {
        return this.type === PersonType.INDIVIDUAL;
      }
    },
    organizationName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    normalizedPhone: { type: String, required: true, trim: true },
    idType: { type: String, enum: Object.values(PersonIdType) },
    idNumber: { type: String, trim: true },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'IN' }
    }
  },
  {
    timestamps: true
  }
);

// Pre-validate hook to automatically compute E.164 normalizedPhone
personSchema.pre('validate', function (next) {
  if (this.phone) {
    try {
      this.normalizedPhone = normalizePhone(this.phone);
    } catch (err) {
      return next(err as Error);
    }
  }
  next();
});

// Indexes
personSchema.index({ tenantId: 1, normalizedPhone: 1 }, { unique: true });
personSchema.index({ userId: 1 }, { unique: true, sparse: true });
personSchema.index({ tenantId: 1, displayName: 1 });

export const PersonModel = model<IPerson>('Person', personSchema);
