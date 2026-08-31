/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UserDTO {
  id: string;
  tenantId?: string;
  personId?: string;
  email: string;
  role: string;
  status: string;
  firstLogin: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TenantDTO {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: string;
  currency: string;
  timezone: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: Record<string, string>;
  country?: string;
  settings?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionDTO {
  id: string;
  tenantId: string;
  plan: string;
  status: string;
  billingCycle: string;
  amount: number;
  currency: string;
  startDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  limits: {
    maxUsers: number;
    maxActiveLoans: number;
    maxPeople: number;
  };
  createdAt?: Date;
}

export interface PersonDTO {
  id: string;
  tenantId: string;
  userId?: string;
  type: string;
  displayName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  organizationName?: string;
  email?: string;
  phone: string;
  normalizedPhone: string;
  alternatePhone?: string;
  idType?: string;
  idNumber?: string;
  address?: Record<string, string>;
  dateOfBirth?: Date;
  occupation?: string;
  notes?: string;
  status: string;
  hasUserAccount: boolean;
  linkedUserEmail?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const formatUserDTO = (user: any): UserDTO => {
  return {
    id: user._id ? user._id.toString() : user.id,
    tenantId: user.tenantId ? user.tenantId.toString() : undefined,
    personId: user.personId ? user.personId.toString() : undefined,
    email: user.email,
    role: user.role,
    status: user.status,
    firstLogin: !!user.firstLogin,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

export const formatTenantDTO = (tenant: any): TenantDTO => {
  return {
    id: tenant._id ? tenant._id.toString() : tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    domain: tenant.domain,
    status: tenant.status,
    currency: tenant.currency,
    timezone: tenant.timezone,
    contactEmail: tenant.contactEmail,
    contactPhone: tenant.contactPhone,
    address: tenant.address,
    country: tenant.country,
    settings: tenant.settings,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt
  };
};

export const formatSubscriptionDTO = (sub: any): SubscriptionDTO => {
  return {
    id: sub._id ? sub._id.toString() : sub.id,
    tenantId: sub.tenantId ? sub.tenantId.toString() : sub.tenantId,
    plan: sub.plan,
    status: sub.status,
    billingCycle: sub.billingCycle || 'MONTHLY',
    amount: sub.amount || 0,
    currency: sub.currency || 'INR',
    startDate: sub.startDate || sub.currentPeriodStart,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
    limits: sub.limits || { maxUsers: 5, maxActiveLoans: 50, maxPeople: 200 },
    createdAt: sub.createdAt
  };
};

export const formatPersonDTO = (person: any, linkedUserEmail?: string): PersonDTO => {
  return {
    id: person._id ? person._id.toString() : person.id,
    tenantId: person.tenantId ? person.tenantId.toString() : person.tenantId,
    userId: person.userId ? person.userId.toString() : undefined,
    type: person.type || 'INDIVIDUAL',
    displayName: person.displayName,
    firstName: person.firstName,
    middleName: person.middleName,
    lastName: person.lastName,
    organizationName: person.organizationName,
    email: person.email,
    phone: person.phone,
    normalizedPhone: person.normalizedPhone,
    alternatePhone: person.alternatePhone,
    idType: person.idType,
    idNumber: person.idNumber,
    address: person.address,
    dateOfBirth: person.dateOfBirth,
    occupation: person.occupation,
    notes: person.notes,
    status: person.status || 'ACTIVE',
    hasUserAccount: !!(person.userId || person.linkedUserEmail || linkedUserEmail),
    linkedUserEmail: linkedUserEmail || person.linkedUserEmail,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt
  };
};
