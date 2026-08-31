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

describe('Module 7 Payment Management — Payment Reversal Suite (TEST 7)', () => {
  let tenantAId: Types.ObjectId;
  let tenantBId: Types.ObjectId;

  let ownerTokenA: string;
  let adminTokenA: string;
  let officerTokenA: string;
  let ownerTokenB: string;

  let borrowerPersonId: string;
  let lenderPersonId: string;
  let activeLoanId: string;

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

    const passwordHash = await bcrypt.hash('TestPassword123!', 10);

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
    await UserModel.create({
      tenantId: tenantBId,
      email: 'owner@beta.com',
      passwordHash,
      role: UserRole.TENANT_OWNER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

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
  });

  it('TEST 7: should reverse payment and fully restore loan and schedule financial balances', async () => {
    // 1. Snapshot initial state
    const initialLoan = await LoanModel.findById(activeLoanId);
    const initialTotalPaid = parseFloat(initialLoan!.totalPaid.toString());
    const initialOutstandingPrincipal = parseFloat(initialLoan!.outstandingPrincipal.toString());
    const initialOutstandingInterest = parseFloat(initialLoan!.outstandingInterest.toString());
    const initialStatus = initialLoan!.status;

    // 2. Post payment of 5,000
    const paymentRes = await request(app)
      .post('/api/v1/tenant/payments')
      .set('Authorization', `Bearer ${officerTokenA}`)
      .send({
        loanId: activeLoanId,
        amount: 5000,
        paymentDate: '2026-02-01',
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        referenceNumber: 'TXN-REV-001'
      });

    expect(paymentRes.status).toBe(201);
    const paymentId = paymentRes.body.data.id;

    // Check intermediate state
    const afterPaymentLoan = await LoanModel.findById(activeLoanId);
    expect(parseFloat(afterPaymentLoan!.totalPaid.toString())).toBe(5000);
    expect(afterPaymentLoan!.status).toBe(LoanStatus.PARTIALLY_PAID);

    // 3. Reverse payment as TENANT_ADMIN
    const reverseRes = await request(app)
      .post(`/api/v1/tenant/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        reason: 'Duplicate payment mistakenly recorded by teller'
      });

    expect(reverseRes.status).toBe(200);
    expect(reverseRes.body.data.payment.status).toBe(PaymentStatus.REVERSED);
    expect(reverseRes.body.data.payment.reversalReason).toBe('Duplicate payment mistakenly recorded by teller');

    // 4. Verify loan state is completely restored
    const restoredLoan = await LoanModel.findById(activeLoanId);
    expect(parseFloat(restoredLoan!.totalPaid.toString())).toBe(initialTotalPaid);
    expect(parseFloat(restoredLoan!.outstandingPrincipal.toString())).toBeCloseTo(initialOutstandingPrincipal, 2);
    expect(parseFloat(restoredLoan!.outstandingInterest.toString())).toBeCloseTo(initialOutstandingInterest, 2);
    expect(restoredLoan!.status).toBe(initialStatus);

    // 5. Verify schedule state is completely restored
    const firstSchedule = await RepaymentScheduleModel.findOne({
      loanId: activeLoanId,
      installmentNumber: 1
    });
    expect(parseFloat(firstSchedule!.paidAmount.toString())).toBe(0);
    expect(parseFloat(firstSchedule!.paidPrincipal.toString())).toBe(0);
    expect(parseFloat(firstSchedule!.paidInterest.toString())).toBe(0);
    expect(firstSchedule!.status).toBe('PENDING');

    // 6. Verify audit log
    const audit = await AuditLogModel.findOne({
      entity: 'Payment',
      entityId: paymentId,
      action: 'STATUS_CHANGE'
    });
    expect(audit).toBeDefined();
    expect(audit!.changes?.newStatus).toBe(PaymentStatus.REVERSED);
  });

  it('should reject reversal of already reversed payment', async () => {
    // Post payment
    const paymentRes = await request(app)
      .post('/api/v1/tenant/payments')
      .set('Authorization', `Bearer ${officerTokenA}`)
      .send({
        loanId: activeLoanId,
        amount: 3000,
        paymentDate: '2026-02-01',
        paymentMethod: PaymentMethod.CASH
      });

    const paymentId = paymentRes.body.data.id;

    // Reverse once
    await request(app)
      .post(`/api/v1/tenant/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ reason: 'Incorrect entry' });

    // Reverse twice
    const secondReverseRes = await request(app)
      .post(`/api/v1/tenant/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ reason: 'Attempting second reversal' });

    expect(secondReverseRes.status).toBe(400);
    expect(secondReverseRes.body.error.message).toContain('already reversed');
  });

  it('should reject reversal by LOAN_OFFICER with 403 Forbidden', async () => {
    const paymentRes = await request(app)
      .post('/api/v1/tenant/payments')
      .set('Authorization', `Bearer ${officerTokenA}`)
      .send({
        loanId: activeLoanId,
        amount: 2000,
        paymentDate: '2026-02-01',
        paymentMethod: PaymentMethod.CASH
      });

    const paymentId = paymentRes.body.data.id;

    const reverseRes = await request(app)
      .post(`/api/v1/tenant/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${officerTokenA}`)
      .send({ reason: 'Officer attempting reversal' });

    expect(reverseRes.status).toBe(403);
  });

  it('Tenant B cannot reverse Tenant A payment', async () => {
    const paymentRes = await request(app)
      .post('/api/v1/tenant/payments')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        loanId: activeLoanId,
        amount: 2000,
        paymentDate: '2026-02-01',
        paymentMethod: PaymentMethod.CASH
      });

    const paymentId = paymentRes.body.data.id;

    const reverseRes = await request(app)
      .post(`/api/v1/tenant/payments/${paymentId}/reverse`)
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({ reason: 'Tenant B cross-tenant reversal attempt' });

    expect(reverseRes.status).toBe(404);
  });
});
