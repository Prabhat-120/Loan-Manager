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
import { PaymentModel } from '../../modules/payments/payment.model.js';
import { PaymentScheduleAllocationModel } from '../../modules/payments/payment-schedule-allocation.model.js';
import { AuditLogModel } from '../../modules/audit/audit-log.model.js';
import { TenantStatus } from '../../modules/tenants/tenant.types.js';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from '../../modules/tenants/subscription.types.js';
import { UserRole, UserStatus } from '../../modules/users/user.types.js';
import { PersonStatus, PersonType } from '../../modules/persons/person.types.js';
import { LoanType, InterestCalculationMethod, LoanStatus, PaymentFrequency } from '../../modules/loans/loan.types.js';
import { PaymentMethod, PaymentStatus } from '../../modules/payments/payment.types.js';
import { LoanService } from '../../modules/loans/loan.service.js';

describe('Module 7 Payment Management — Payment API Suite', () => {
  let tenantAId: Types.ObjectId;
  let tenantBId: Types.ObjectId;

  let ownerTokenA: string;
  let adminTokenA: string;
  let officerTokenA: string;
  let readOnlyTokenA: string;
  let ownerTokenB: string;

  let borrowerPersonId: string;
  let lenderPersonId: string;
  let activeLoanId: string;
  let draftLoanId: string;

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
    await PaymentModel.deleteMany({});
    await PaymentScheduleAllocationModel.deleteMany({});
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
      plan: SubscriptionPlan.GROWTH,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      limits: { maxUsers: 20, maxActiveLoans: 200, maxPeople: 1000 }
    });

    // Setup Tenant B
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
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      limits: { maxUsers: 5, maxActiveLoans: 20, maxPeople: 100 }
    });

    const passwordHash = await bcrypt.hash('TestPassword123!', 10);

    // Users for Tenant A
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

    // User for Tenant B
    await UserModel.create({
      tenantId: tenantBId,
      email: 'owner@beta.com',
      passwordHash,
      role: UserRole.TENANT_OWNER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    // Get Auth Tokens
    const login = async (email: string) => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'TestPassword123!' });
      return res.body.data.accessToken;
    };

    ownerTokenA = await login('owner@alpha.com');
    adminTokenA = await login('admin@alpha.com');
    officerTokenA = await login('officer@alpha.com');
    readOnlyTokenA = await login('readonly@alpha.com');
    ownerTokenB = await login('owner@beta.com');

    // Create People for Tenant A
    const borrower = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      firstName: 'Ramesh',
      lastName: 'Patel',
      phone: '+91 98765 43210',
      normalizedPhone: '+919876543210',
      status: PersonStatus.ACTIVE
    });
    borrowerPersonId = borrower._id.toString();

    const lender = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      firstName: 'Suresh',
      lastName: 'Gupta',
      phone: '+91 98765 43211',
      normalizedPhone: '+919876543211',
      status: PersonStatus.ACTIVE
    });
    lenderPersonId = lender._id.toString();

    // Create ACTIVE Loan in Tenant A (Principal 100,000, 12% p.a., 12 months EMI)
    const loanResult = await LoanService.createLoan(
      tenantAId,
      {
        lenderPersonId,
        borrowerPersonId,
        loanType: LoanType.EMI,
        principalAmount: 100000,
        interestRate: 12,
        interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
        termMonths: 12,
        startDate: '2026-01-01',
        firstDueDate: '2026-02-01',
        paymentFrequency: PaymentFrequency.MONTHLY
      },
      ownerA._id.toString(),
      LoanStatus.ACTIVE
    );
    activeLoanId = loanResult.loan.id;

    // Create DRAFT Loan in Tenant A
    const draftResult = await LoanService.createLoan(
      tenantAId,
      {
        lenderPersonId,
        borrowerPersonId,
        loanType: LoanType.EMI,
        principalAmount: 50000,
        interestRate: 10,
        interestCalculationMethod: InterestCalculationMethod.FLAT,
        termMonths: 6,
        startDate: '2026-01-01',
        firstDueDate: '2026-02-01',
        paymentFrequency: PaymentFrequency.MONTHLY
      },
      ownerA._id.toString(),
      LoanStatus.DRAFT
    );
    draftLoanId = draftResult.loan.id;
  });

  describe('Payment Preview API (POST /api/v1/tenant/payments/preview)', () => {
    it('should generate accurate preview matching backend allocation without mutating DB state', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/payments/preview')
        .set('Authorization', `Bearer ${officerTokenA}`)
        .send({
          loanId: activeLoanId,
          amount: 8884.88
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.loanId).toBe(activeLoanId);
      expect(parseFloat(res.body.data.paymentAmount)).toBeCloseTo(8884.88, 2);
      expect(parseFloat(res.body.data.allocatedInterest)).toBeCloseTo(1000.0, 2);
      expect(parseFloat(res.body.data.allocatedPrincipal)).toBeCloseTo(7884.88, 2);
      expect(parseFloat(res.body.data.unallocatedAmount)).toBe(0);

      // Verify no payment was created in database
      const paymentsCount = await PaymentModel.countDocuments({ loanId: activeLoanId });
      expect(paymentsCount).toBe(0);
    });

    it('should reject preview on a DRAFT loan', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/payments/preview')
        .set('Authorization', `Bearer ${officerTokenA}`)
        .send({
          loanId: draftLoanId,
          amount: 5000
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('DRAFT loan');
    });
  });

  describe('Payment Creation API (POST /api/v1/tenant/payments)', () => {
    it('should successfully post payment, update schedules, update loan financials, and write audit log', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${officerTokenA}`)
        .send({
          loanId: activeLoanId,
          amount: 8884.88,
          paymentDate: '2026-02-01',
          paymentMethod: PaymentMethod.UPI,
          referenceNumber: 'UPI-TXN-12345',
          notes: 'First installment payment'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentNumber).toMatch(/^PMT-2026-\d{6}$/);
      expect(res.body.data.status).toBe(PaymentStatus.POSTED);
      expect(parseFloat(res.body.data.allocatedInterest)).toBeCloseTo(1000.0, 2);
      expect(parseFloat(res.body.data.allocatedPrincipal)).toBeCloseTo(7884.88, 2);
      expect(parseFloat(res.body.data.unallocatedAmount)).toBe(0);

      // Verify schedule updated
      const firstSchedule = await RepaymentScheduleModel.findOne({
        loanId: activeLoanId,
        installmentNumber: 1
      });
      expect(firstSchedule).toBeDefined();
      expect(firstSchedule!.status).toBe('PAID');
      expect(parseFloat(firstSchedule!.paidAmount.toString())).toBeCloseTo(8884.88, 2);

      // Verify loan financials updated
      const loan = await LoanModel.findById(activeLoanId);
      expect(loan!.status).toBe(LoanStatus.PARTIALLY_PAID);
      expect(parseFloat(loan!.totalPaid.toString())).toBeCloseTo(8884.88, 2);

      // Verify audit log created
      const audit = await AuditLogModel.findOne({
        entity: 'Payment',
        entityId: res.body.data.id
      });
      expect(audit).toBeDefined();
      expect(audit!.action).toBe('CREATE');
    });

    it('should reject payment creation from READ_ONLY user with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${readOnlyTokenA}`)
        .send({
          loanId: activeLoanId,
          amount: 5000,
          paymentDate: '2026-02-01',
          paymentMethod: PaymentMethod.CASH
        });

      expect(res.status).toBe(403);
    });

    it('should reject payment with negative or zero amount', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({
          loanId: activeLoanId,
          amount: -100,
          paymentDate: '2026-02-01',
          paymentMethod: PaymentMethod.CASH
        });

      expect(res.status).toBe(400);
    });

    it('should reject payment against a DRAFT loan', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({
          loanId: draftLoanId,
          amount: 1000,
          paymentDate: '2026-02-01',
          paymentMethod: PaymentMethod.CASH
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('DRAFT loan');
    });
  });

  describe('Tenant Isolation', () => {
    it('Tenant B cannot post payment against Tenant A loan', async () => {
      const res = await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .send({
          loanId: activeLoanId,
          amount: 5000,
          paymentDate: '2026-02-01',
          paymentMethod: PaymentMethod.CASH
        });

      expect(res.status).toBe(404);
    });

    it('Tenant B cannot view Tenant A payments', async () => {
      // Post payment in Tenant A
      const createRes = await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          loanId: activeLoanId,
          amount: 5000,
          paymentDate: '2026-02-01',
          paymentMethod: PaymentMethod.CASH
        });

      const paymentId = createRes.body.data.id;

      // Tenant B attempts to view
      const viewRes = await request(app)
        .get(`/api/v1/tenant/payments/${paymentId}`)
        .set('Authorization', `Bearer ${ownerTokenB}`);

      expect(viewRes.status).toBe(404);
    });

    it('Tenant B cannot view Tenant A loan payment history', async () => {
      const res = await request(app)
        .get(`/api/v1/tenant/loans/${activeLoanId}/payments`)
        .set('Authorization', `Bearer ${ownerTokenB}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Payment Query & Listing API', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          loanId: activeLoanId,
          amount: 5000,
          paymentDate: '2026-02-01',
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: 'CASH-001'
        });

      await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          loanId: activeLoanId,
          amount: 3000,
          paymentDate: '2026-03-01',
          paymentMethod: PaymentMethod.UPI,
          referenceNumber: 'UPI-002'
        });
    });

    it('should list payments with pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${readOnlyTokenA}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it('should filter payments by paymentMethod', async () => {
      const res = await request(app)
        .get('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${officerTokenA}`)
        .query({ paymentMethod: PaymentMethod.UPI });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].paymentMethod).toBe(PaymentMethod.UPI);
    });

    it('should return loan payment history with financial summary', async () => {
      const res = await request(app)
        .get(`/api/v1/tenant/loans/${activeLoanId}/payments`)
        .set('Authorization', `Bearer ${readOnlyTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.payments).toHaveLength(2);
      expect(parseFloat(res.body.data.totalPaid)).toBeCloseTo(8000, 2);
    });
  });
});
