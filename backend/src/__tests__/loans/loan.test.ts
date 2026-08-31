import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../../app.js';
import { TenantModel } from '../../modules/tenants/tenant.model.js';
import { SubscriptionModel } from '../../modules/tenants/subscription.model.js';
import { UserModel } from '../../modules/users/user.model.js';
import { PersonModel } from '../../modules/persons/person.model.js';
import { LoanModel } from '../../modules/loans/loan.model.js';
import { RepaymentScheduleModel } from '../../modules/loans/repayment-schedule.model.js';
import { AuditLogModel } from '../../modules/audit/audit-log.model.js';
import { TenantStatus } from '../../modules/tenants/tenant.types.js';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from '../../modules/tenants/subscription.types.js';
import { UserRole, UserStatus } from '../../modules/users/user.types.js';
import { PersonStatus, PersonType } from '../../modules/persons/person.types.js';
import { LoanType, InterestCalculationMethod, LoanStatus } from '../../modules/loans/loan.types.js';

describe('Module 6 Loan Management Backend Tests', () => {
  let tenantAId: Types.ObjectId;
  let tenantBId: Types.ObjectId;

  let ownerTokenA: string;
  let adminTokenA: string;
  let officerTokenA: string;
  let readOnlyTokenA: string;
  let ownerTokenB: string;

  let personA1Id: string;
  let personA2Id: string;
  let personA3Id: string;
  let personInactiveId: string;
  let personB1Id: string;

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
    await LoanModel.deleteMany({});
    await RepaymentScheduleModel.deleteMany({});
    await AuditLogModel.deleteMany({});

    // Setup Tenant A
    const tenantA = await TenantModel.create({
      name: 'Alpha Lending',
      slug: 'alpha-lending',
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
      limits: { maxUsers: 5, maxActiveLoans: 2, maxPeople: 200 } // limit maxActiveLoans = 2 for testing
    });

    // Setup Tenant B (for IDOR testing)
    const tenantB = await TenantModel.create({
      name: 'Beta Finance',
      slug: 'beta-finance',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      country: 'IN',
      status: TenantStatus.ACTIVE
    });
    tenantBId = tenantB._id;

    await SubscriptionModel.create({
      tenantId: tenantBId,
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      amount: 999,
      currency: 'INR',
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      limits: { maxUsers: 5, maxActiveLoans: 50, maxPeople: 200 }
    });

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // Create Tenant A Users
    await UserModel.create([
      { tenantId: tenantAId, email: 'owner@alpha.com', passwordHash, role: UserRole.TENANT_OWNER, status: UserStatus.ACTIVE, firstLogin: false },
      { tenantId: tenantAId, email: 'admin@alpha.com', passwordHash, role: UserRole.TENANT_ADMIN, status: UserStatus.ACTIVE, firstLogin: false },
      { tenantId: tenantAId, email: 'officer@alpha.com', passwordHash, role: UserRole.LOAN_OFFICER, status: UserStatus.ACTIVE, firstLogin: false },
      { tenantId: tenantAId, email: 'readonly@alpha.com', passwordHash, role: UserRole.READ_ONLY, status: UserStatus.ACTIVE, firstLogin: false }
    ]);

    // Create Tenant B User
    await UserModel.create([
      { tenantId: tenantBId, email: 'owner@beta.com', passwordHash, role: UserRole.TENANT_OWNER, status: UserStatus.ACTIVE, firstLogin: false }
    ]);

    // Create People for Tenant A
    const personA1 = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      displayName: 'Alice Lender',
      firstName: 'Alice',
      lastName: 'Lender',
      phone: '+919876543210',
      normalizedPhone: '+919876543210',
      status: PersonStatus.ACTIVE
    });
    personA1Id = personA1._id.toString();

    const personA2 = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      displayName: 'Bob Borrower',
      firstName: 'Bob',
      lastName: 'Borrower',
      phone: '+919876543211',
      normalizedPhone: '+919876543211',
      status: PersonStatus.ACTIVE
    });
    personA2Id = personA2._id.toString();

    const personA3 = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      displayName: 'Charlie Investor',
      firstName: 'Charlie',
      lastName: 'Investor',
      phone: '+919876543212',
      normalizedPhone: '+919876543212',
      status: PersonStatus.ACTIVE
    });
    personA3Id = personA3._id.toString();

    const personInactive = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      displayName: 'David Inactive',
      firstName: 'David',
      lastName: 'Inactive',
      phone: '+919876543213',
      normalizedPhone: '+919876543213',
      status: PersonStatus.INACTIVE
    });
    personInactiveId = personInactive._id.toString();

    // Create Person for Tenant B
    const personB1 = await PersonModel.create({
      tenantId: tenantBId,
      type: PersonType.INDIVIDUAL,
      displayName: 'Zara Beta',
      firstName: 'Zara',
      lastName: 'Beta',
      phone: '+919876543299',
      normalizedPhone: '+919876543299',
      status: PersonStatus.ACTIVE
    });
    personB1Id = personB1._id.toString();

    // Login to get tokens
    const loginOwnerA = await request(app).post('/api/v1/auth/login').send({ email: 'owner@alpha.com', password: 'Password123!' });
    ownerTokenA = loginOwnerA.body.data.accessToken;

    const loginAdminA = await request(app).post('/api/v1/auth/login').send({ email: 'admin@alpha.com', password: 'Password123!' });
    adminTokenA = loginAdminA.body.data.accessToken;

    const loginOfficerA = await request(app).post('/api/v1/auth/login').send({ email: 'officer@alpha.com', password: 'Password123!' });
    officerTokenA = loginOfficerA.body.data.accessToken;

    const loginReadOnlyA = await request(app).post('/api/v1/auth/login').send({ email: 'readonly@alpha.com', password: 'Password123!' });
    readOnlyTokenA = loginReadOnlyA.body.data.accessToken;

    const loginOwnerB = await request(app).post('/api/v1/auth/login').send({ email: 'owner@beta.com', password: 'Password123!' });
    ownerTokenB = loginOwnerB.body.data.accessToken;
  });

  describe('1. Loan Creation & Validation', () => {
    it('creates an EMI loan with auto-generated loanNumber, schedule, and audit log', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          lenderPersonId: personA1Id,
          borrowerPersonId: personA2Id,
          loanType: LoanType.EMI,
          principalAmount: '100000',
          interestRate: '12',
          interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
          termMonths: 12,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01',
          notes: 'Test EMI Loan'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.loan.loanNumber).toMatch(/^LN-2026-\d{6}$/);
      expect(res.body.data.loan.status).toBe(LoanStatus.DRAFT);
      expect(res.body.data.loan.principalAmount).toBe('100000.00');
      expect(res.body.data.lender.displayName).toBe('Alice Lender');
      expect(res.body.data.borrower.displayName).toBe('Bob Borrower');
      expect(res.body.data.scheduleSummary.totalInstallments).toBe(12);

      // Verify schedule saved in DB
      const schedule = await RepaymentScheduleModel.find({ loanId: res.body.data.loan.id });
      expect(schedule).toHaveLength(12);
      expect(schedule[0].installmentNumber).toBe(1);
      expect(schedule[11].installmentNumber).toBe(12);

      // Verify audit log created
      const audit = await AuditLogModel.findOne({ entityId: res.body.data.loan.id });
      expect(audit).not.toBeNull();
      expect(audit?.action).toBe('CREATE');
    });

    it('rejects loan creation if lender and borrower are the same person', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          lenderPersonId: personA1Id,
          borrowerPersonId: personA1Id,
          loanType: LoanType.INTEREST_ONLY,
          principalAmount: '50000',
          interestRate: '10',
          interestCalculationMethod: InterestCalculationMethod.FLAT,
          termMonths: 6,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Lender and Borrower cannot be the same Person');
    });

    it('rejects loan creation if lender or borrower is INACTIVE', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          lenderPersonId: personA1Id,
          borrowerPersonId: personInactiveId,
          loanType: LoanType.INTEREST_ONLY,
          principalAmount: '50000',
          interestRate: '10',
          interestCalculationMethod: InterestCalculationMethod.FLAT,
          termMonths: 6,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('inactive');
    });

    it('rejects loan creation with negative or 0 principal', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          lenderPersonId: personA1Id,
          borrowerPersonId: personA2Id,
          loanType: LoanType.EMI,
          principalAmount: '0',
          interestRate: '12',
          interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
          termMonths: 12,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Role Authorization Matrix', () => {
    it('allows LOAN_OFFICER to create and activate a loan, but blocks cancel', async () => {
      // Create by LOAN_OFFICER -> Allowed
      const createRes = await request(app)
        .post('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${officerTokenA}`)
        .send({
          lenderPersonId: personA1Id,
          borrowerPersonId: personA2Id,
          loanType: LoanType.INTEREST_ONLY,
          principalAmount: '50000',
          interestRate: '12',
          interestCalculationMethod: InterestCalculationMethod.FLAT,
          termMonths: 6,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01'
        });

      expect(createRes.status).toBe(201);
      const loanId = createRes.body.data.loan.id;

      // Update DRAFT by LOAN_OFFICER -> Allowed
      const updateRes = await request(app)
        .patch(`/api/v1/tenant/loans/${loanId}`)
        .set('Authorization', `Bearer ${officerTokenA}`)
        .send({ notes: 'Updated by officer' });
      expect(updateRes.status).toBe(200);

      // Cancel by LOAN_OFFICER -> Blocked (403 Forbidden)
      const cancelRes = await request(app)
        .post(`/api/v1/tenant/loans/${loanId}/cancel`)
        .set('Authorization', `Bearer ${officerTokenA}`);
      expect(cancelRes.status).toBe(403);

      // Activate by LOAN_OFFICER -> Allowed
      const activateRes = await request(app)
        .post(`/api/v1/tenant/loans/${loanId}/activate`)
        .set('Authorization', `Bearer ${officerTokenA}`);
      expect(activateRes.status).toBe(200);
      expect(activateRes.body.data.loan.status).toBe(LoanStatus.ACTIVE);
    });

    it('allows TENANT_ADMIN to create, update, and cancel a loan', async () => {
      const createRes = await request(app)
        .post('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({
          lenderPersonId: personA1Id,
          borrowerPersonId: personA2Id,
          loanType: LoanType.INTEREST_ONLY,
          principalAmount: '50000',
          interestRate: '12',
          interestCalculationMethod: InterestCalculationMethod.FLAT,
          termMonths: 6,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01'
        });
      expect(createRes.status).toBe(201);
      const loanId = createRes.body.data.loan.id;

      const cancelRes = await request(app)
        .post(`/api/v1/tenant/loans/${loanId}/cancel`)
        .set('Authorization', `Bearer ${adminTokenA}`);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.loan.status).toBe(LoanStatus.CANCELLED);
    });

    it('blocks READ_ONLY from creating, editing, activating, or cancelling loans', async () => {
      // Create -> Blocked 403
      const createRes = await request(app)
        .post('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${readOnlyTokenA}`)
        .send({
          lenderPersonId: personA1Id,
          borrowerPersonId: personA2Id,
          loanType: LoanType.INTEREST_ONLY,
          principalAmount: '50000',
          interestRate: '12',
          interestCalculationMethod: InterestCalculationMethod.FLAT,
          termMonths: 6,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01'
        });
      expect(createRes.status).toBe(403);

      // Read -> Allowed 200
      const listRes = await request(app)
        .get('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${readOnlyTokenA}`);
      expect(listRes.status).toBe(200);
    });
  });

  describe('3. Tenant Isolation & IDOR Protection', () => {
    it('prevents cross-tenant lender/borrower assignment and prevents Tenant B from reading or modifying Tenant A loan', async () => {
      // 1. Cannot create loan in Tenant A with Tenant B Person
      const crossCreate = await request(app)
        .post('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          lenderPersonId: personB1Id,
          borrowerPersonId: personA2Id,
          loanType: LoanType.INTEREST_ONLY,
          principalAmount: '50000',
          interestRate: '12',
          interestCalculationMethod: InterestCalculationMethod.FLAT,
          termMonths: 6,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01'
        });
      expect(crossCreate.status).toBe(404);

      // Create a valid loan in Tenant A
      const createRes = await request(app)
        .post('/api/v1/tenant/loans')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          lenderPersonId: personA1Id,
          borrowerPersonId: personA2Id,
          loanType: LoanType.INTEREST_ONLY,
          principalAmount: '50000',
          interestRate: '12',
          interestCalculationMethod: InterestCalculationMethod.FLAT,
          termMonths: 6,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01'
        });
      const loanAId = createRes.body.data.loan.id;

      // Tenant B owner attempts to read Tenant A loan -> 404 Not Found
      const getRes = await request(app)
        .get(`/api/v1/tenant/loans/${loanAId}`)
        .set('Authorization', `Bearer ${ownerTokenB}`);
      expect(getRes.status).toBe(404);

      // Tenant B owner attempts to read Tenant A schedule -> 404 Not Found
      const schedRes = await request(app)
        .get(`/api/v1/tenant/loans/${loanAId}/schedule`)
        .set('Authorization', `Bearer ${ownerTokenB}`);
      expect(schedRes.status).toBe(404);

      // Tenant B owner attempts to activate Tenant A loan -> 404 Not Found
      const actRes = await request(app)
        .post(`/api/v1/tenant/loans/${loanAId}/activate`)
        .set('Authorization', `Bearer ${ownerTokenB}`);
      expect(actRes.status).toBe(404);
    });
  });

  describe('4. Subscription Loan Limit Enforcement', () => {
    it('blocks activating a 3rd loan when maxActiveLoans limit is 2, while allowing DRAFT loans', async () => {
      // Create 3 DRAFT loans in Tenant A (maxActiveLoans limit is 2)
      const loan1 = await request(app).post('/api/v1/tenant/loans').set('Authorization', `Bearer ${ownerTokenA}`).send({
        lenderPersonId: personA1Id, borrowerPersonId: personA2Id, loanType: LoanType.EMI, principalAmount: '10000', interestRate: '10', interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE, termMonths: 6, startDate: '2026-01-01', firstDueDate: '2026-02-01'
      });
      const loan2 = await request(app).post('/api/v1/tenant/loans').set('Authorization', `Bearer ${ownerTokenA}`).send({
        lenderPersonId: personA1Id, borrowerPersonId: personA2Id, loanType: LoanType.EMI, principalAmount: '20000', interestRate: '10', interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE, termMonths: 6, startDate: '2026-01-01', firstDueDate: '2026-02-01'
      });
      const loan3 = await request(app).post('/api/v1/tenant/loans').set('Authorization', `Bearer ${ownerTokenA}`).send({
        lenderPersonId: personA1Id, borrowerPersonId: personA2Id, loanType: LoanType.EMI, principalAmount: '30000', interestRate: '10', interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE, termMonths: 6, startDate: '2026-01-01', firstDueDate: '2026-02-01'
      });

      // All 3 DRAFT loans created successfully
      expect(loan1.status).toBe(201);
      expect(loan2.status).toBe(201);
      expect(loan3.status).toBe(201);

      // Activate loan 1 -> count = 1 -> Allowed
      const act1 = await request(app).post(`/api/v1/tenant/loans/${loan1.body.data.loan.id}/activate`).set('Authorization', `Bearer ${ownerTokenA}`);
      expect(act1.status).toBe(200);

      // Activate loan 2 -> count = 2 -> Allowed (limit is 2)
      const act2 = await request(app).post(`/api/v1/tenant/loans/${loan2.body.data.loan.id}/activate`).set('Authorization', `Bearer ${ownerTokenA}`);
      expect(act2.status).toBe(200);

      // Activate loan 3 -> count would be 3 > 2 -> Blocked (403 Forbidden)
      const act3 = await request(app).post(`/api/v1/tenant/loans/${loan3.body.data.loan.id}/activate`).set('Authorization', `Bearer ${ownerTokenA}`);
      expect(act3.status).toBe(403);
      expect(act3.body.error.message).toContain('Active loan limit');
    });
  });

  describe('5. Person Dual-Role (Lender vs Borrower) & Loan Relationship APIs', () => {
    it('allows Person A to give a loan to B, and take a loan from C; verifies both endpoints', async () => {
      // Loan #1: Alice (Person A1) GIVES loan to Bob (Person A2)
      const loan1 = await request(app).post('/api/v1/tenant/loans').set('Authorization', `Bearer ${ownerTokenA}`).send({
        lenderPersonId: personA1Id,
        borrowerPersonId: personA2Id,
        loanType: LoanType.INTEREST_ONLY,
        principalAmount: '100000',
        interestRate: '12',
        interestCalculationMethod: InterestCalculationMethod.FLAT,
        termMonths: 12,
        startDate: '2026-01-01',
        firstDueDate: '2026-02-01'
      });
      expect(loan1.status).toBe(201);

      // Loan #2: Charlie (Person A3) GIVES loan to Alice (Person A1)
      const loan2 = await request(app).post('/api/v1/tenant/loans').set('Authorization', `Bearer ${ownerTokenA}`).send({
        lenderPersonId: personA3Id,
        borrowerPersonId: personA1Id,
        loanType: LoanType.FULL_PAYMENT,
        principalAmount: '50000',
        interestRate: '10',
        interestCalculationMethod: InterestCalculationMethod.FLAT,
        termMonths: 6,
        startDate: '2026-01-01',
        firstDueDate: '2026-02-01'
      });
      expect(loan2.status).toBe(201);

      // Check Alice's Loans Given
      const givenRes = await request(app)
        .get(`/api/v1/tenant/persons/${personA1Id}/loans-given`)
        .set('Authorization', `Bearer ${ownerTokenA}`);
      expect(givenRes.status).toBe(200);
      expect(givenRes.body.data.loans).toHaveLength(1);
      expect(givenRes.body.data.loans[0].principalAmount).toBe('100000.00');

      // Check Alice's Loans Taken
      const takenRes = await request(app)
        .get(`/api/v1/tenant/persons/${personA1Id}/loans-taken`)
        .set('Authorization', `Bearer ${ownerTokenA}`);
      expect(takenRes.status).toBe(200);
      expect(takenRes.body.data.loans).toHaveLength(1);
      expect(takenRes.body.data.loans[0].principalAmount).toBe('50000.00');
    });
  });

  describe('6. Preview Schedule Endpoint', () => {
    it('returns calculated schedule preview for frontend without creating any records in DB', async () => {
      const countBefore = await LoanModel.countDocuments();
      const res = await request(app)
        .post('/api/v1/tenant/loans/preview-schedule')
        .set('Authorization', `Bearer ${officerTokenA}`)
        .send({
          loanType: LoanType.EMI,
          principalAmount: '120000',
          annualInterestRate: '12',
          interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
          termMonths: 12,
          startDate: '2026-01-01',
          firstDueDate: '2026-02-01'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.schedule).toHaveLength(12);
      expect(res.body.data.principalAmount).toBe('120000.00');

      const countAfter = await LoanModel.countDocuments();
      expect(countAfter).toBe(countBefore);
    });
  });
});
