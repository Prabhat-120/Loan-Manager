import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../../app.js';
import { TenantModel } from '../../modules/tenants/tenant.model.js';
import { SubscriptionModel } from '../../modules/tenants/subscription.model.js';
import { UserModel } from '../../modules/users/user.model.js';
import { PersonModel } from '../../modules/persons/person.model.ts';
import { TenantStatus } from '../../modules/tenants/tenant.types.js';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from '../../modules/tenants/subscription.types.js';
import { UserRole, UserStatus } from '../../modules/users/user.types.js';
import { PersonStatus, PersonType } from '../../modules/persons/person.types.js';

describe('Module 5 Person Management Tests', () => {
  let tenantAId: Types.ObjectId;
  let tenantBId: Types.ObjectId;

  let ownerTokenA: string;
  let adminTokenA: string;
  let officerTokenA: string;
  let readOnlyTokenA: string;
  let ownerTokenB: string;

  let unlinkedUserAId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/loan-manager-test');
    }
  });

  beforeEach(async () => {
    await TenantModel.deleteMany({});
    await SubscriptionModel.deleteMany({});
    await UserModel.deleteMany({});
    await PersonModel.deleteMany({});

    // Setup Tenant A (India - default IN)
    const tenantA = await TenantModel.create({
      name: 'Alpha Finance',
      slug: 'alpha-finance',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      country: 'IN',
      status: TenantStatus.ACTIVE
    });
    tenantAId = tenantA._id;

    await SubscriptionModel.create({
      tenantId: tenantAId,
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      amount: 999,
      currency: 'INR',
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      limits: { maxUsers: 10, maxActiveLoans: 100, maxPeople: 5 } // Max 5 people for testing
    });

    // Setup Tenant B (US - default US)
    const tenantB = await TenantModel.create({
      name: 'Beta Credit',
      slug: 'beta-credit',
      currency: 'USD',
      timezone: 'America/New_York',
      country: 'US',
      status: TenantStatus.ACTIVE
    });
    tenantBId = tenantB._id;

    await SubscriptionModel.create({
      tenantId: tenantBId,
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      amount: 99,
      currency: 'USD',
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      limits: { maxUsers: 10, maxActiveLoans: 100, maxPeople: 50 }
    });

    const passwordHash = await bcrypt.hash('Secret123456!', 10);

    // Tenant A Users
    await UserModel.create({
      tenantId: tenantAId,
      email: 'owner@alpha.com',
      passwordHash,
      role: UserRole.TENANT_OWNER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    await UserModel.create({
      tenantId: tenantAId,
      email: 'admin@alpha.com',
      passwordHash,
      role: UserRole.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    await UserModel.create({
      tenantId: tenantAId,
      email: 'officer@alpha.com',
      passwordHash,
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    await UserModel.create({
      tenantId: tenantAId,
      email: 'readonly@alpha.com',
      passwordHash,
      role: UserRole.READ_ONLY,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    const unlinkedUser = await UserModel.create({
      tenantId: tenantAId,
      email: 'unlinked@alpha.com',
      passwordHash,
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });
    unlinkedUserAId = unlinkedUser._id.toString();

    // Tenant B Users
    await UserModel.create({
      tenantId: tenantBId,
      email: 'owner@beta.com',
      passwordHash,
      role: UserRole.TENANT_OWNER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    // Login tokens
    const login = async (email: string) => {
      const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Secret123456!' });
      return res.body.data.accessToken;
    };

    ownerTokenA = await login('owner@alpha.com');
    adminTokenA = await login('admin@alpha.com');
    officerTokenA = await login('officer@alpha.com');
    readOnlyTokenA = await login('readonly@alpha.com');
    ownerTokenB = await login('owner@beta.com');
  });

  it('1. International Phone Normalization & Consistent Display Name', async () => {
    // 1. Create Person in Tenant A (country: IN) without + prefix
    const resA = await request(app)
      .post('/api/v1/tenant/persons')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        firstName: 'Ramesh',
        middleName: 'Kumar',
        lastName: 'Sharma',
        phone: '9876543210'
      });

    expect(resA.status).toBe(201);
    expect(resA.body.data.displayName).toBe('Ramesh Kumar Sharma');
    expect(resA.body.data.normalizedPhone).toBe('+919876543210');

    // 2. Create Person in Tenant B (country: US) without + prefix
    const resB = await request(app)
      .post('/api/v1/tenant/persons')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        phone: '2025550143'
      });

    expect(resB.status).toBe(201);
    expect(resB.body.data.displayName).toBe('John Doe');
    expect(resB.body.data.normalizedPhone).toBe('+12025550143');
  });

  it('2. Normal Create Person throws 409 Conflict if phone exists in tenant', async () => {
    await request(app)
      .post('/api/v1/tenant/persons')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ firstName: 'First', lastName: 'Person', phone: '+919876543211' });

    // Attempting normal create with same phone in Tenant A should return 409 Conflict
    const res = await request(app)
      .post('/api/v1/tenant/persons')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ firstName: 'Duplicate', lastName: 'Person', phone: '9876543211' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('already exists');
  });

  it('3. Lookup-or-Create returns existing Person without throwing error or consuming slot', async () => {
    // 1. Initial lookup-or-create creates person
    const res1 = await request(app)
      .post('/api/v1/tenant/persons/lookup-or-create')
      .set('Authorization', `Bearer ${officerTokenA}`)
      .send({ firstName: 'Sita', lastName: 'Ram', phone: '9876543212' });

    expect(res1.status).toBe(200);
    expect(res1.body.data.created).toBe(true);

    // 2. Second lookup-or-create with same phone returns existing Person with created: false
    const res2 = await request(app)
      .post('/api/v1/tenant/persons/lookup-or-create')
      .set('Authorization', `Bearer ${officerTokenA}`)
      .send({ phone: '+919876543212' });

    expect(res2.status).toBe(200);
    expect(res2.body.data.created).toBe(false);
    expect(res2.body.data.person.id).toBe(res1.body.data.person.id);
  });

  it('4. Subscription Limit Enforcement', async () => {
    // Tenant A limit is 5 people. Create 4 more (1 already created in previous tests or clean DB)
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post('/api/v1/tenant/persons')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ firstName: `Person${i}`, lastName: 'Test', phone: `987654322${i}` });
    }

    // 6th Person creation should be blocked by 403 Forbidden
    const res = await request(app)
      .post('/api/v1/tenant/persons')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ firstName: 'Excess', lastName: 'Person', phone: '9876543299' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('maximum person limit');
  });

  it('5. Tenant Isolation: Tenant B cannot access Tenant A Person', async () => {
    const personA = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      displayName: 'Secret Alpha Person',
      firstName: 'Secret',
      lastName: 'Alpha',
      phone: '+919876543300',
      normalizedPhone: '+919876543300',
      status: PersonStatus.ACTIVE
    });

    // Tenant B owner attempts GET /tenant/persons/:personId
    const res = await request(app)
      .get(`/api/v1/tenant/persons/${personA._id}`)
      .set('Authorization', `Bearer ${ownerTokenB}`);

    expect(res.status).toBe(404);
  });

  it('6. Transactional Link & Unlink User with Role Restrictions', async () => {
    const person = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      displayName: 'Linkable Person',
      firstName: 'Linkable',
      lastName: 'Person',
      phone: '+919876543400',
      normalizedPhone: '+919876543400',
      status: PersonStatus.ACTIVE
    });

    // 1. LOAN_OFFICER cannot link user (403)
    const officerRes = await request(app)
      .post(`/api/v1/tenant/persons/${person._id}/link-user`)
      .set('Authorization', `Bearer ${officerTokenA}`)
      .send({ userId: unlinkedUserAId });

    expect(officerRes.status).toBe(403);

    // 2. TENANT_ADMIN links user
    const adminLinkRes = await request(app)
      .post(`/api/v1/tenant/persons/${person._id}/link-user`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ userId: unlinkedUserAId });

    expect(adminLinkRes.status).toBe(200);
    expect(adminLinkRes.body.data.hasUserAccount).toBe(true);

    // 3. TENANT_ADMIN cannot unlink user (403 - TENANT_OWNER ONLY)
    const adminUnlinkRes = await request(app)
      .post(`/api/v1/tenant/persons/${person._id}/unlink-user`)
      .set('Authorization', `Bearer ${adminTokenA}`);

    expect(adminUnlinkRes.status).toBe(403);

    // 4. TENANT_OWNER unlinks user
    const ownerUnlinkRes = await request(app)
      .post(`/api/v1/tenant/persons/${person._id}/unlink-user`)
      .set('Authorization', `Bearer ${ownerTokenA}`);

    expect(ownerUnlinkRes.status).toBe(200);
    expect(ownerUnlinkRes.body.data.hasUserAccount).toBe(false);
  });

  it('7. READ_ONLY Role Restrictions', async () => {
    // 1. READ_ONLY can search persons
    const listRes = await request(app)
      .get('/api/v1/tenant/persons')
      .set('Authorization', `Bearer ${readOnlyTokenA}`);

    expect(listRes.status).toBe(200);

    // 2. READ_ONLY cannot create person (403)
    const createRes = await request(app)
      .post('/api/v1/tenant/persons')
      .set('Authorization', `Bearer ${readOnlyTokenA}`)
      .send({ firstName: 'Blocked', lastName: 'User', phone: '9876543999' });

    expect(createRes.status).toBe(403);

    // 3. READ_ONLY cannot lookup-or-create (403)
    const lookupRes = await request(app)
      .post('/api/v1/tenant/persons/lookup-or-create')
      .set('Authorization', `Bearer ${readOnlyTokenA}`)
      .send({ phone: '9876543999' });

    expect(lookupRes.status).toBe(403);
  });

  it('8. Soft Lifecycle Management & Audit History', async () => {
    const person = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      displayName: 'Deactivatable Person',
      firstName: 'Deactivatable',
      lastName: 'Person',
      phone: '+919876543500',
      normalizedPhone: '+919876543500',
      status: PersonStatus.ACTIVE
    });

    // Deactivate status
    const statusRes = await request(app)
      .patch(`/api/v1/tenant/persons/${person._id}/status`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ status: PersonStatus.INACTIVE });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe(PersonStatus.INACTIVE);

    // Fetch audit logs for person
    const auditRes = await request(app)
      .get(`/api/v1/tenant/persons/${person._id}/audit-logs`)
      .set('Authorization', `Bearer ${ownerTokenA}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.auditLogs.length).toBeGreaterThanOrEqual(1);
  });
});
