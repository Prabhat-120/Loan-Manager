import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { TenantModel } from './tenant.model.js';
import { ITenant, TenantStatus } from './tenant.types.js';
import { SubscriptionModel } from './subscription.model.js';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from './subscription.types.js';
import { PLAN_DEFAULT_LIMITS } from './subscription.service.js';
import { UserModel } from '../users/user.model.js';
import { UserRole, UserStatus } from '../users/user.types.js';
import { PersonModel } from '../persons/person.model.js';
import { AuditLogModel } from '../audit/audit-log.model.js';
import { AuditAction, AuditScope } from '../audit/audit-log.types.js';
import { slugify } from '../../common/utils/slug.js';
import { generateRandomToken } from '../../common/utils/token.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';
import { formatTenantDTO, formatSubscriptionDTO, formatUserDTO } from '../../common/utils/dto.js';

export interface OnboardTenantInput {
  name: string;
  slug?: string;
  domain?: string;
  currency?: string;
  timezone?: string;
  contactEmail: string;
  contactPhone: string;
  country?: string;
  address?: Record<string, string>;
  subscriptionPlan?: SubscriptionPlan;
  billingCycle?: BillingCycle;
  ownerEmail: string;
  ownerFirstName?: string;
  ownerLastName?: string;
}

export class TenantService {
  /**
   * Onboard a new Tenant with initial Subscription and initial TENANT_OWNER atomically.
   */
  static async onboardTenant(input: OnboardTenantInput, creatorUserId?: string) {
    const rawSlug = input.slug || slugify(input.name);
    const existingSlug = await TenantModel.findOne({ slug: rawSlug });
    if (existingSlug) {
      throw new BadRequestError(`Tenant slug '${rawSlug}' is already taken. Please choose another.`);
    }

    const existingEmail = await UserModel.findOne({ email: input.ownerEmail.toLowerCase() });
    if (existingEmail) {
      throw new BadRequestError(`User email '${input.ownerEmail}' is already registered.`);
    }

    const tempPassword = `TmpPass!${generateRandomToken().substring(0, 8)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    let session: mongoose.ClientSession | undefined;
    let useTransaction = true;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      useTransaction = false;
    }

    let createdTenantId: Types.ObjectId | undefined;

    try {
      let tenant;
      if (useTransaction && session) {
        try {
          const [t] = await TenantModel.create(
            [
              {
                name: input.name,
                slug: rawSlug,
                domain: input.domain,
                currency: input.currency || 'INR',
                timezone: input.timezone || 'Asia/Kolkata',
                contactEmail: input.contactEmail,
                contactPhone: input.contactPhone,
                country: input.country || 'IN',
                address: input.address,
                status: TenantStatus.ACTIVE
              }
            ],
            { session }
          );
          tenant = t;
        } catch (err: any) {
          if (
            err?.message?.includes('Transaction numbers are only allowed') ||
            err?.codeName === 'IllegalOperation'
          ) {
            useTransaction = false;
            await session.endSession();
            session = undefined;
            tenant = await TenantModel.create({
              name: input.name,
              slug: rawSlug,
              domain: input.domain,
              currency: input.currency || 'INR',
              timezone: input.timezone || 'Asia/Kolkata',
              contactEmail: input.contactEmail,
              contactPhone: input.contactPhone,
              country: input.country || 'IN',
              address: input.address,
              status: TenantStatus.ACTIVE
            });
          } else {
            throw err;
          }
        }
      } else {
        tenant = await TenantModel.create({
          name: input.name,
          slug: rawSlug,
          domain: input.domain,
          currency: input.currency || 'INR',
          timezone: input.timezone || 'Asia/Kolkata',
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          country: input.country || 'IN',
          address: input.address,
          status: TenantStatus.ACTIVE
        });
      }

      createdTenantId = tenant._id;

      // 2. Create Initial Subscription
      const plan = input.subscriptionPlan || SubscriptionPlan.STARTER;
      const billingCycle = input.billingCycle || BillingCycle.MONTHLY;
      const now = new Date();
      const periodEnd = new Date(now);
      if (billingCycle === BillingCycle.YEARLY) {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      let subscription;
      if (useTransaction && session) {
        const [sub] = await SubscriptionModel.create(
          [
            {
              tenantId: tenant._id,
              plan,
              status: SubscriptionStatus.ACTIVE,
              billingCycle,
              amount: plan === SubscriptionPlan.FREE ? 0 : plan === SubscriptionPlan.STARTER ? 999 : 2999,
              currency: tenant.currency,
              startDate: now,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
              limits: PLAN_DEFAULT_LIMITS[plan]
            }
          ],
          { session }
        );
        subscription = sub;
      } else {
        subscription = await SubscriptionModel.create({
          tenantId: tenant._id,
          plan,
          status: SubscriptionStatus.ACTIVE,
          billingCycle,
          amount: plan === SubscriptionPlan.FREE ? 0 : plan === SubscriptionPlan.STARTER ? 999 : 2999,
          currency: tenant.currency,
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          limits: PLAN_DEFAULT_LIMITS[plan]
        });
      }

      // 3. Create Initial TENANT_OWNER User
      let ownerUser;
      if (useTransaction && session) {
        const [user] = await UserModel.create(
          [
            {
              tenantId: tenant._id,
              email: input.ownerEmail.toLowerCase(),
              passwordHash,
              role: UserRole.TENANT_OWNER,
              status: UserStatus.ACTIVE,
              firstLogin: true
            }
          ],
          { session }
        );
        ownerUser = user;
      } else {
        ownerUser = await UserModel.create({
          tenantId: tenant._id,
          email: input.ownerEmail.toLowerCase(),
          passwordHash,
          role: UserRole.TENANT_OWNER,
          status: UserStatus.ACTIVE,
          firstLogin: true
        });
      }

      // 4. Create Audit Log
      if (useTransaction && session) {
        await AuditLogModel.create(
          [
            {
              scope: AuditScope.PLATFORM,
              userId: creatorUserId ? new Types.ObjectId(creatorUserId) : undefined,
              action: AuditAction.CREATE,
              entity: 'Tenant',
              entityId: tenant._id.toString(),
              changes: { name: tenant.name, slug: tenant.slug, ownerEmail: input.ownerEmail, plan }
            }
          ],
          { session }
        );
        await session.commitTransaction();
      } else {
        await AuditLogModel.create({
          scope: AuditScope.PLATFORM,
          userId: creatorUserId ? new Types.ObjectId(creatorUserId) : undefined,
          action: AuditAction.CREATE,
          entity: 'Tenant',
          entityId: tenant._id.toString(),
          changes: { name: tenant.name, slug: tenant.slug, ownerEmail: input.ownerEmail, plan }
        });
      }

      return {
        tenant: formatTenantDTO(tenant),
        subscription: formatSubscriptionDTO(subscription),
        ownerUser: formatUserDTO(ownerUser),
        temporaryPassword: tempPassword,
        warning: 'This temporary password is provided ONCE and cannot be retrieved later.'
      };
    } catch (error) {
      if (useTransaction && session) {
        await session.abortTransaction();
      } else if (createdTenantId) {
        await TenantModel.deleteOne({ _id: createdTenantId });
        await SubscriptionModel.deleteMany({ tenantId: createdTenantId });
        await UserModel.deleteMany({ tenantId: createdTenantId });
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * List tenants for Platform Owner with search, filter, and pagination
   */
  static async listTenants(query: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.status && Object.values(TenantStatus).includes(query.status as TenantStatus)) {
      filter.status = query.status;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [{ name: searchRegex }, { slug: searchRegex }, { contactEmail: searchRegex }];
    }

    const [tenants, total] = await Promise.all([
      TenantModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      TenantModel.countDocuments(filter)
    ]);

    return {
      tenants: tenants.map(formatTenantDTO),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single tenant details by ID
   */
  static async getTenantById(tenantId: string) {
    const tenant = await TenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const [subscription, ownerUser, userCount, personCount] = await Promise.all([
      SubscriptionModel.findOne({ tenantId }),
      UserModel.findOne({ tenantId, role: UserRole.TENANT_OWNER }),
      UserModel.countDocuments({ tenantId, status: UserStatus.ACTIVE }),
      PersonModel.countDocuments({ tenantId })
    ]);

    return {
      tenant: formatTenantDTO(tenant),
      subscription: subscription ? formatSubscriptionDTO(subscription) : null,
      ownerUser: ownerUser ? formatUserDTO(ownerUser) : null,
      stats: {
        userCount,
        personCount
      }
    };
  }

  /**
   * Update tenant operational profile/settings
   */
  static async updateTenant(tenantId: string, updates: Partial<ITenant>, updatedByUserId?: string) {
    const tenant = await TenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    if (updates.name) tenant.name = updates.name;
    if (updates.contactEmail) tenant.contactEmail = updates.contactEmail;
    if (updates.contactPhone) tenant.contactPhone = updates.contactPhone;
    if (updates.timezone) tenant.timezone = updates.timezone;
    if (updates.country) tenant.country = updates.country;
    if (updates.address) tenant.address = { ...tenant.address, ...updates.address };
    if (updates.settings) tenant.settings = { ...tenant.settings, ...updates.settings };

    await tenant.save();

    await AuditLogModel.create({
      scope: AuditScope.TENANT,
      tenantId: tenant._id,
      userId: updatedByUserId ? new Types.ObjectId(updatedByUserId) : undefined,
      action: AuditAction.UPDATE,
      entity: 'Tenant',
      entityId: tenant._id.toString(),
      changes: updates
    });

    return formatTenantDTO(tenant);
  }

  /**
   * Update tenant status (ACTIVE, SUSPENDED, INACTIVE)
   */
  static async updateTenantStatus(tenantId: string, newStatus: TenantStatus, updatedByUserId?: string) {
    const tenant = await TenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const previousStatus = tenant.status;
    tenant.status = newStatus;
    await tenant.save();

    await AuditLogModel.create({
      scope: AuditScope.PLATFORM,
      tenantId: tenant._id,
      userId: updatedByUserId ? new Types.ObjectId(updatedByUserId) : undefined,
      action: AuditAction.STATUS_CHANGE,
      entity: 'Tenant',
      entityId: tenant._id.toString(),
      changes: { previousStatus, newStatus }
    });

    return formatTenantDTO(tenant);
  }

  /**
   * Update subscription details for a tenant
   */
  static async updateSubscription(tenantId: string, updates: Record<string, unknown>, updatedByUserId?: string) {
    const subscription = await SubscriptionModel.findOne({ tenantId });
    if (!subscription) {
      throw new NotFoundError('Subscription not found for this tenant');
    }

    if (updates.plan && Object.values(SubscriptionPlan).includes(updates.plan as SubscriptionPlan)) {
      subscription.plan = updates.plan as SubscriptionPlan;
      subscription.limits = PLAN_DEFAULT_LIMITS[subscription.plan];
    }
    if (updates.status && Object.values(SubscriptionStatus).includes(updates.status as SubscriptionStatus)) {
      subscription.status = updates.status as SubscriptionStatus;
    }
    if (updates.billingCycle && Object.values(BillingCycle).includes(updates.billingCycle as BillingCycle)) {
      subscription.billingCycle = updates.billingCycle as BillingCycle;
    }
    if (typeof updates.amount === 'number') {
      subscription.amount = updates.amount;
    }
    if (updates.currentPeriodEnd) {
      subscription.currentPeriodEnd = new Date(updates.currentPeriodEnd as string | Date);
    }

    await subscription.save();

    await AuditLogModel.create({
      scope: AuditScope.PLATFORM,
      tenantId: subscription.tenantId,
      userId: updatedByUserId ? new Types.ObjectId(updatedByUserId) : undefined,
      action: AuditAction.UPDATE,
      entity: 'Subscription',
      entityId: subscription._id!.toString(),
      changes: updates
    });

    return formatSubscriptionDTO(subscription);
  }

  /**
   * Get Platform Owner Dashboard Metrics
   */
  static async getPlatformDashboardMetrics() {
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      inactiveTenants,
      totalUsers,
      activeSubscriptions,
      expiredSubscriptions,
      nearingExpiryTenants,
      recentTenants
    ] = await Promise.all([
      TenantModel.countDocuments(),
      TenantModel.countDocuments({ status: TenantStatus.ACTIVE }),
      TenantModel.countDocuments({ status: TenantStatus.SUSPENDED }),
      TenantModel.countDocuments({ status: TenantStatus.INACTIVE }),
      UserModel.countDocuments({ role: { $ne: UserRole.PLATFORM_OWNER } }),
      SubscriptionModel.countDocuments({ status: SubscriptionStatus.ACTIVE }),
      SubscriptionModel.countDocuments({ currentPeriodEnd: { $lt: new Date() } }),
      SubscriptionModel.countDocuments({
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { $gte: new Date(), $lte: in30Days }
      }),
      TenantModel.find().sort({ createdAt: -1 }).limit(5)
    ]);

    return {
      metrics: {
        totalTenants,
        activeTenants,
        suspendedTenants,
        inactiveTenants,
        totalUsers,
        activeSubscriptions,
        expiredSubscriptions,
        nearingExpiryTenants
      },
      recentTenants: recentTenants.map(formatTenantDTO)
    };
  }

  /**
   * Get Tenant Owner Dashboard Metrics
   */
  static async getTenantDashboardMetrics(tenantId: string) {
    const tenant = await TenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const [subscription, userCount, personCount] = await Promise.all([
      SubscriptionModel.findOne({ tenantId }),
      UserModel.countDocuments({ tenantId, status: UserStatus.ACTIVE }),
      PersonModel.countDocuments({ tenantId })
    ]);

    return {
      tenant: formatTenantDTO(tenant),
      subscription: subscription ? formatSubscriptionDTO(subscription) : null,
      stats: {
        userCount,
        personCount,
        activeLoanCount: 0
      }
    };
  }

  /**
   * Helper to verify a tenant retains at least one active TENANT_OWNER
   */
  static async verifyLastOwnerProtection(tenantId: string | Types.ObjectId, targetUserId: string) {
    const activeOwnersCount = await UserModel.countDocuments({
      tenantId,
      role: UserRole.TENANT_OWNER,
      status: UserStatus.ACTIVE
    });

    const targetUser = await UserModel.findOne({ _id: targetUserId, tenantId });
    if (targetUser && targetUser.role === UserRole.TENANT_OWNER && targetUser.status === UserStatus.ACTIVE) {
      if (activeOwnersCount <= 1) {
        throw new ForbiddenError('Cannot deactivate, remove, or demote the last active TENANT_OWNER.');
      }
    }
  }
}
