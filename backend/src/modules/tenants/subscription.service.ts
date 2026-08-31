import { Types } from 'mongoose';
import { SubscriptionModel } from './subscription.model.js';
import { SubscriptionPlan, ISubscriptionLimits } from './subscription.types.js';
import { UserModel } from '../users/user.model.js';
import { UserStatus, UserRole } from '../users/user.types.js';
import { PersonModel } from '../persons/person.model.js';

export const PLAN_DEFAULT_LIMITS: Record<SubscriptionPlan, ISubscriptionLimits> = {
  [SubscriptionPlan.FREE]: { maxUsers: 2, maxActiveLoans: 10, maxPeople: 50 },
  [SubscriptionPlan.STARTER]: { maxUsers: 5, maxActiveLoans: 50, maxPeople: 200 },
  [SubscriptionPlan.PROFESSIONAL]: { maxUsers: 20, maxActiveLoans: 250, maxPeople: 1000 },
  [SubscriptionPlan.ENTERPRISE]: { maxUsers: 100, maxActiveLoans: 2000, maxPeople: 10000 }
};

export class SubscriptionLimitService {
  /**
   * Check if tenant has reached active user limit
   */
  static async checkUserLimit(tenantId: string | Types.ObjectId): Promise<{ allowed: boolean; current: number; max: number }> {
    const sub = await SubscriptionModel.findOne({ tenantId });
    const limits = sub?.limits || PLAN_DEFAULT_LIMITS[SubscriptionPlan.STARTER];

    const currentActiveUsers = await UserModel.countDocuments({
      tenantId,
      status: UserStatus.ACTIVE,
      role: { $ne: UserRole.PLATFORM_OWNER }
    });

    return {
      allowed: currentActiveUsers < limits.maxUsers,
      current: currentActiveUsers,
      max: limits.maxUsers
    };
  }

  /**
   * Check if tenant has reached person limit
   */
  static async checkPersonLimit(tenantId: string | Types.ObjectId): Promise<{ allowed: boolean; current: number; max: number }> {
    const sub = await SubscriptionModel.findOne({ tenantId });
    const limits = sub?.limits || PLAN_DEFAULT_LIMITS[SubscriptionPlan.STARTER];

    const currentPeople = await PersonModel.countDocuments({ tenantId });

    return {
      allowed: currentPeople < limits.maxPeople,
      current: currentPeople,
      max: limits.maxPeople
    };
  }
}
