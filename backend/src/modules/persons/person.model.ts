import { Schema, model } from 'mongoose';
import { IPerson, PersonType, PersonStatus, PersonIdType } from './person.types.js';
import { normalizePhone } from '../../common/utils/phone.js';

const personSchema = new Schema<IPerson>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: Object.values(PersonType), default: PersonType.INDIVIDUAL },
    status: { type: String, enum: Object.values(PersonStatus), default: PersonStatus.ACTIVE, index: true },
    displayName: { type: String, required: true, trim: true },
    firstName: {
      type: String,
      trim: true,
      required: function (this: IPerson) {
        return this.type === PersonType.INDIVIDUAL;
      }
    },
    middleName: { type: String, trim: true },
    lastName: {
      type: String,
      trim: true,
      required: function (this: IPerson) {
        return this.type === PersonType.INDIVIDUAL;
      }
    },
    organizationName: {
      type: String,
      trim: true,
      required: function (this: IPerson) {
        return this.type === PersonType.ORGANIZATION;
      }
    },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    normalizedPhone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true },
    idType: { type: String, enum: Object.values(PersonIdType) },
    idNumber: { type: String, trim: true },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'IN' }
    },
    dateOfBirth: { type: Date },
    occupation: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

// Pre-validate hook for consistent displayName generation & E.164 phone normalization
personSchema.pre('validate', function (next) {
  if (this.type === PersonType.ORGANIZATION && this.organizationName) {
    this.displayName = this.organizationName.trim();
  } else {
    const parts = [this.firstName, this.middleName, this.lastName].filter((p) => Boolean(p && p.trim()));
    if (parts.length > 0) {
      this.displayName = parts.join(' ');
    }
  }

  if (this.phone && !this.normalizedPhone) {
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
personSchema.index({ tenantId: 1, email: 1 });
personSchema.index({ tenantId: 1, status: 1 });

export const PersonModel = model<IPerson>('Person', personSchema);
