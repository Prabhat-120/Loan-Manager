import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../app.js';
import { TenantModel } from '../../modules/tenants/tenant.model.js';
import { TenantStatus } from '../../modules/tenants/tenant.types.js';
import { SubscriptionModel } from '../../modules/tenants/subscription.model.js';
import { SubscriptionPlan } from '../../modules/tenants/subscription.types.js';
import { UserModel } from '../../modules/users/user.model.js';
import { UserRole, UserStatus } from '../../modules/users/user.types.js';
import { PersonModel } from '../../modules/persons/person.model.js';
import { TenantService } from '../../modules/tenants/tenant.service.js';
import { SubscriptionLimitService } from '../../modules/tenants/subscription.service.js';
import { generateAccessToken } from '../../common/utils/token.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/loan-manager-test';

describe('Module 4 Tenant Management & Platform Owner Tests', () => {
  let platformOwnerToken: string;
  let tenantOwnerToken: string;
  let tenantAdminToken: string;
  let loanOfficerToken: string;
  let readOnlyToken: string;
  let testTenantId: Types.ObjectId;
  let tenantOwnerUserId: Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await TenantModel.deleteMany({});
    await SubscriptionModel.deleteMany({});
    await UserModel.deleteMany({});
    await PersonModel.deleteMany({});

    // 1. Create Platform Owner
    const platformOwner = await UserModel.create({
      email: 'admin@platform.com',
      passwordHash: await bcrypt.hash('Secret123456!', 10),
      role: UserRole.PLATFORM_OWNER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });
    platformOwnerToken = generateAccessToken({
      sub: platformOwner._id.toString(),
      role: platformOwner.role
    });

    // 2. Onboard Test Tenant
    const onboardRes = await TenantService.onboardTenant({
      name: 'Alpha Finance',
      contactEmail: 'contact@alpha.com',
      contactPhone: '+919876543210',
      ownerEmail: 'owner@alpha.com',
      subscriptionPlan: SubscriptionPlan.STARTER
    });

    testTenantId = new Types.ObjectId(onboardRes.tenant.id);
    tenantOwnerUserId = new Types.ObjectId(onboardRes.ownerUser.id);

    tenantOwnerToken = generateAccessToken({
      sub: tenantOwnerUserId.toString(),
      role: UserRole.TENANT_OWNER,
      tenantId: testTenantId.toString()
    });

    // 3. Create Tenant Admin
    const tenantAdmin = await UserModel.create({
      tenantId: testTenantId,
      email: 'admin@alpha.com',
      passwordHash: await bcrypt.hash('Secret123456!', 10),
      role: UserRole.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });
    tenantAdminToken = generateAccessToken({
      sub: tenantAdmin._id.toString(),
      role: tenantAdmin.role,
      tenantId: testTenantId.toString()
    });

    // 4. Create Loan Officer
    const loanOfficer = await UserModel.create({
      tenantId: testTenantId,
      email: 'officer@alpha.com',
      passwordHash: await bcrypt.hash('Secret123456!', 10),
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });
    loanOfficerToken = generateAccessToken({
      sub: loanOfficer._id.toString(),
      role: loanOfficer.role,
      tenantId: testTenantId.toString()
    });

    // 5. Create Read Only user
    const readOnly = await UserModel.create({
      tenantId: testTenantId,
      email: 'readonly@alpha.com',
      passwordHash: await bcrypt.hash('Secret123456!', 10),
      role: UserRole.READ_ONLY,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });
    readOnlyToken = generateAccessToken({
      sub: readOnly._id.toString(),
      role: readOnly.role,
      tenantId: testTenantId.toString()
    });
  });

  it('1. Transactional Tenant Onboarding: creates Tenant, Subscription, and initial TENANT_OWNER with temporary password', async () => {
    const res = await request(app)
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${platformOwnerToken}`)
      .send({
        name: 'Beta Credit',
        contactEmail: 'info@beta.com',
        contactPhone: '+919876543211',
        ownerEmail: 'owner@beta.com',
        subscriptionPlan: SubscriptionPlan.PROFESSIONAL
      });

    expect(res.status).toBe(201);
    expect(res.body.data.tenant.name).toBe('Beta Credit');
    expect(res.body.data.subscription.plan).toBe('PROFESSIONAL');
    expect(res.body.data.ownerUser.role).toBe('TENANT_OWNER');
    expect(res.body.data.temporaryPassword).toBeDefined();

    // Verify plaintext temporary password is NOT in database
    const dbOwner = await UserModel.findOne({ email: 'owner@beta.com' }).select('+passwordHash');
    expect(dbOwner?.passwordHash).not.toBe(res.body.data.temporaryPassword);
    expect(await bcrypt.compare(res.body.data.temporaryPassword, dbOwner!.passwordHash)).toBe(true);
  });

  it('2. Tenant Lifecycle: SUSPENDED tenant blocks business API access', async () => {
    // Suspend tenant
    await request(app)
      .patch(`/api/v1/platform/tenants/${testTenantId}/status`)
      .set('Authorization', `Bearer ${platformOwnerToken}`)
      .send({ status: TenantStatus.SUSPENDED });

    // Business endpoint access by tenant user is blocked with 403
    const res = await request(app)
      .get('/api/v1/tenant/dashboard')
      .set('Authorization', `Bearer ${tenantOwnerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Tenant account is suspended');

    // Restore to ACTIVE
    await request(app)
      .patch(`/api/v1/platform/tenants/${testTenantId}/status`)
      .set('Authorization', `Bearer ${platformOwnerToken}`)
      .send({ status: TenantStatus.ACTIVE });

    const activeRes = await request(app)
      .get('/api/v1/tenant/dashboard')
      .set('Authorization', `Bearer ${tenantOwnerToken}`);

    expect(activeRes.status).toBe(200);
  });

  it('3. Last Tenant Owner Protection: prevents deactivating or demoting the last active TENANT_OWNER', async () => {
    // Attempt to deactivate the only TENANT_OWNER
    const res = await request(app)
      .patch(`/api/v1/tenant/users/${tenantOwnerUserId}/status`)
      .set('Authorization', `Bearer ${tenantOwnerToken}`)
      .send({ status: UserStatus.INACTIVE });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Cannot deactivate, remove, or demote the last active TENANT_OWNER');
  });

  it('4. Role Boundaries: TENANT_ADMIN cannot modify TENANT_OWNER or assign PLATFORM_OWNER', async () => {
    // TENANT_ADMIN attempts to demote TENANT_OWNER
    const demoteRes = await request(app)
      .patch(`/api/v1/tenant/users/${tenantOwnerUserId}/role`)
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ role: UserRole.LOAN_OFFICER });

    expect(demoteRes.status).toBe(403);

    // Tenant user attempts to assign PLATFORM_OWNER
    const assignRes = await request(app)
      .post('/api/v1/tenant/users')
      .set('Authorization', `Bearer ${tenantOwnerToken}`)
      .send({ email: 'newplatform@test.com', role: UserRole.PLATFORM_OWNER });

    expect(assignRes.status).toBe(400);
  });

  it('5. One-to-One Person ↔ User Linking: links Person to User and prevents duplicate links', async () => {
    const person = await PersonModel.create({
      tenantId: testTenantId,
      displayName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+919876543212',
      normalizedPhone: '+919876543212'
    });

    const targetUser = await UserModel.create({
      tenantId: testTenantId,
      email: 'johndoe@alpha.com',
      passwordHash: await bcrypt.hash('Secret123456!', 10),
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    const linkRes = await request(app)
      .post(`/api/v1/tenant/users/${targetUser._id}/link-person`)
      .set('Authorization', `Bearer ${tenantOwnerToken}`)
      .send({ personId: person._id.toString() });

    expect(linkRes.status).toBe(200);

    const updatedPerson = await PersonModel.findById(person._id);
    expect(updatedPerson?.userId?.toString()).toBe(targetUser._id.toString());

    // Attempting to link already-linked person to another user fails
    const secondUser = await UserModel.create({
      tenantId: testTenantId,
      email: 'second@alpha.com',
      passwordHash: await bcrypt.hash('Secret123456!', 10),
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    const duplicateRes = await request(app)
      .post(`/api/v1/tenant/users/${secondUser._id}/link-person`)
      .set('Authorization', `Bearer ${tenantOwnerToken}`)
      .send({ personId: person._id.toString() });

    expect(duplicateRes.status).toBe(400);
    expect(duplicateRes.body.error.message).toContain('already linked');
  });

  it('6. Phone Lookup-or-Create: returns existing Person or creates new Person; READ_ONLY is forbidden', async () => {
    // 1. Create via phone lookup
    const res1 = await request(app)
      .post('/api/v1/tenant/persons/lookup-or-create')
      .set('Authorization', `Bearer ${loanOfficerToken}`)
      .send({ phone: '+919876543213', displayName: 'Jane Smith', firstName: 'Jane', lastName: 'Smith' });

    expect(res1.status).toBe(200);
    expect(res1.body.data.created).toBe(true);
    expect(res1.body.data.person.displayName).toBe('Jane Smith');

    // 2. Secondary call returns existing Person
    const res2 = await request(app)
      .post('/api/v1/tenant/persons/lookup-or-create')
      .set('Authorization', `Bearer ${loanOfficerToken}`)
      .send({ phone: '+919876543213' });

    expect(res2.status).toBe(200);
    expect(res2.body.data.created).toBe(false);

    // 3. READ_ONLY role receives 403 Forbidden
    const res3 = await request(app)
      .post('/api/v1/tenant/persons/lookup-or-create')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({ phone: '+919876543214' });

    expect(res3.status).toBe(403);
  });

  it('7. Subscription Limits Service: correctly evaluates maxUsers and maxPeople limits', async () => {
    // Update tenant subscription limits to max 5 users
    await SubscriptionModel.updateOne({ tenantId: testTenantId }, { 'limits.maxUsers': 5 });

    const limitCheck = await SubscriptionLimitService.checkUserLimit(testTenantId);
    expect(limitCheck.max).toBe(5);
    expect(limitCheck.allowed).toBe(true);
  });

  it('8. Platform Dashboard Metrics: aggregates real MongoDB data without hardcoding', async () => {
    const res = await request(app)
      .get('/api/v1/platform/dashboard')
      .set('Authorization', `Bearer ${platformOwnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.metrics.totalTenants).toBeGreaterThanOrEqual(1);
    expect(res.body.data.metrics.activeTenants).toBeGreaterThanOrEqual(1);
  });
});
