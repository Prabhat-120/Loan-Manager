import { Schema, model } from 'mongoose';
import { IUser, UserRole, UserStatus } from './user.types.js';

const userSchema = new Schema<IUser>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: function (this: IUser) {
        return this.role !== UserRole.PLATFORM_OWNER;
      }
    },
    personId: { type: Schema.Types.ObjectId, ref: 'Person' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.LOAN_OFFICER },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
    lastLoginAt: { type: Date }
  },
  {
    timestamps: true
  }
);

userSchema.index({ personId: 1 }, { unique: true, sparse: true });
userSchema.index({ tenantId: 1, role: 1 });

export const UserModel = model<IUser>('User', userSchema);
