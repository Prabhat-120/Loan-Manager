import { z } from 'zod';
import { TenantStatus } from './tenant.types.js';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from './subscription.types.js';
import { UserRole, UserStatus } from '../users/user.types.js';

export const createTenantOnboardingSchema = z.object({
  name: z.string().trim().min(2, 'Tenant name must be at least 2 characters'),
  slug: z.string().trim().toLowerCase().optional(),
  domain: z.string().trim().toLowerCase().optional(),
  currency: z.string().trim().toUpperCase().default('INR'),
  timezone: z.string().trim().default('Asia/Kolkata'),
  contactEmail: z.string().trim().email('Invalid contact email'),
  contactPhone: z.string().trim().min(5, 'Invalid contact phone'),
  country: z.string().trim().default('IN'),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    })
    .optional(),
  subscriptionPlan: z.nativeEnum(SubscriptionPlan).default(SubscriptionPlan.STARTER),
  billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.MONTHLY),
  ownerEmail: z.string().trim().email('Invalid owner email address'),
  ownerFirstName: z.string().trim().optional(),
  ownerLastName: z.string().trim().optional()
});

export const updateTenantProfileSchema = z.object({
  name: z.string().trim().min(2).optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().optional(),
  timezone: z.string().trim().optional(),
  country: z.string().trim().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    })
    .optional(),
  settings: z
    .object({
      loanNumberPrefix: z.string().optional(),
      dateFormat: z.string().optional(),
      autoEmailReminders: z.boolean().optional()
    })
    .optional()
});

export const updateTenantStatusSchema = z.object({
  status: z.nativeEnum(TenantStatus)
});

export const updateSubscriptionSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan).optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  billingCycle: z.nativeEnum(BillingCycle).optional(),
  amount: z.number().min(0).optional(),
  currentPeriodEnd: z.string().datetime().or(z.date()).optional(),
  cancelAtPeriodEnd: z.boolean().optional()
});

export const inviteTenantUserSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  role: z.nativeEnum(UserRole).refine((role) => role !== UserRole.PLATFORM_OWNER, {
    message: 'Cannot assign PLATFORM_OWNER role to a tenant user'
  }),
  personId: z.string().optional()
});

export const updateTenantUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole).refine((role) => role !== UserRole.PLATFORM_OWNER, {
    message: 'Cannot assign PLATFORM_OWNER role to a tenant user'
  })
});

export const updateTenantUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus)
});
