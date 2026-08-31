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
import { IdempotencyKeyModel } from '../../modules/payments/idempotency.model.js';
import { AuditLogModel } from '../../modules/audit/audit-log.model.js';
import { TenantStatus } from '../../modules/tenants/tenant.types.js';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from '../../modules/tenants/subscription.types.js';
import { UserRole, UserStatus } from '../../modules/users/user.types.js';
import { PersonStatus, PersonType } from '../../modules/persons/person.types.js';
import { LoanType, InterestCalculationMethod, LoanStatus, PaymentFrequency } from '../../modules/loans/loan.types.js';
import { PaymentMethod } from '../../modules/payments/payment.types.js';
import { LoanService } from '../../modules/loans/loan.service.js';
import { ReconciliationService } from '../../modules/payments/reconciliation.service.js';

describe('Module 7 Payment Management — Concurrency & Idempotency Suite (TEST 8 & TEST 9)', () => {
  let tenantId: Types.ObjectId;
  let ownerToken: string;
  let loanId: string;

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
    await IdempotencyKeyModel.deleteMany({});
    await AuditLogModel.deleteMany({});

    const tenant = await TenantModel.create({
      name: 'Concurrency Lending',
      slug: 'concurrency-lending',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      country: 'IN',
      status: TenantStatus.ACTIVE
    });
    tenantId = tenant._id;

    await SubscriptionModel.create({
      tenantId,
      plan: SubscriptionPlan.ENTERPRISE,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      limits: { maxUsers: 50, maxActiveLoans: 500, maxPeople: 2000 }
    });

    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const owner = await UserModel.create({
      tenantId,
      email: 'owner@concurrency.com',
      passwordHash,
      role: UserRole.TENANT_OWNER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@concurrency.com', password: 'TestPassword123!' });
    ownerToken = loginRes.body.data.accessToken;

    const borrower = await PersonModel.create({
      tenantId,
      type: PersonType.INDIVIDUAL,
      firstName: 'Aarav',
      lastName: 'Sharma',
      phone: '+91 98765 11111',
      normalizedPhone: '+919876511111',
      status: PersonStatus.ACTIVE
    });

    const lender = await PersonModel.create({
      tenantId,
      type: PersonType.INDIVIDUAL,
      firstName: 'Kavita',
      lastName: 'Verma',
      phone: '+91 98765 22222',
      normalizedPhone: '+919876522222',
      status: PersonStatus.ACTIVE
    });

    // Create a loan with Principal 10,000, 0% interest (flat), 1 month, totalPayable = 10,000
    const loanResult = await LoanService.createLoan(
      tenantId,
      {
        lenderPersonId: lender._id.toString(),
        borrowerPersonId: borrower._id.toString(),
        loanType: LoanType.FULL_PAYMENT,
        principalAmount: 10000,
        interestRate: 0,
        interestCalculationMethod: InterestCalculationMethod.FLAT,
        termMonths: 1,
        startDate: '2026-01-01',
        firstDueDate: '2026-02-01',
        paymentFrequency: PaymentFrequency.MONTHLY
      },
      owner._id.toString(),
      LoanStatus.ACTIVE
    );
    loanId = loanResult.loan.id;
  });

  describe('TEST 8: Idempotency Key Duplicate Request Protection', () => {
    it('should return identical payment result on idempotent replay without duplicate DB records', async () => {
      const idempotencyKey = `idemp-${Date.now()}`;
      const payload = {
        loanId,
        amount: 5000,
        paymentDate: '2026-02-01',
        paymentMethod: PaymentMethod.UPI,
        referenceNumber: 'UPI-IDEMP-001',
        notes: 'First attempt'
      };

      // First request
      const res1 = await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.body.data.paymentNumber).toBeDefined();
      const firstPaymentNumber = res1.body.data.paymentNumber;

      // Second request (identical key and payload)
      const res2 = await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.data.paymentNumber).toBe(firstPaymentNumber);
      expect(res2.body.isDuplicate).toBe(true);

      // Verify only one payment document was created
      const count = await PaymentModel.countDocuments({ tenantId, loanId });
      expect(count).toBe(1);
    });

    it('should reject request when same idempotency key is reused with a different payload', async () => {
      const idempotencyKey = `idemp-conflict-${Date.now()}`;

      // First request (5,000)
      await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          loanId,
          amount: 5000,
          paymentDate: '2026-02-01',
          paymentMethod: PaymentMethod.UPI
        });

      // Second request with different amount (7,000)
      const conflictRes = await request(app)
        .post('/api/v1/tenant/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          loanId,
          amount: 7000,
          paymentDate: '2026-02-01',
          paymentMethod: PaymentMethod.UPI
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.message).toContain('different request payload');
    });
  });

  describe('TEST 9: Concurrent Payments Safety', () => {
    it('should maintain financial integrity when concurrent payments are submitted', async () => {
      // Loan has 10,000 obligation
      // Simultaneously submit 8,000 and 7,000
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/tenant/payments')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            loanId,
            amount: 8000,
            paymentDate: '2026-02-01',
            paymentMethod: PaymentMethod.UPI
          }),
        request(app)
          .post('/api/v1/tenant/payments')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            loanId,
            amount: 7000,
            paymentDate: '2026-02-01',
            paymentMethod: PaymentMethod.CASH
          })
      ]);

      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);

      // Verify financial reconciliation
      const reconciliation = await ReconciliationService.reconcileLoanFinancials(tenantId, loanId);
      expect(reconciliation.isReconciled).toBe(true);
      expect(reconciliation.discrepancies).toHaveLength(0);

      // Total allocated principal across schedules must NOT exceed 10,000
      const schedule = await RepaymentScheduleModel.findOne({ loanId });
      expect(parseFloat(schedule!.paidAmount.toString())).toBeLessThanOrEqual(10000);
      expect(parseFloat(schedule!.remainingAmount.toString())).toBe(0);

      // Sum of payment amounts = 15,000 (8,000 + 7,000)
      // Allocated must be exactly 10,000, and unallocated must be exactly 5,000
      const payments = await PaymentModel.find({ loanId });
      expect(payments).toHaveLength(2);

      const totalAllocatedPrincipal = payments.reduce(
        (sum, p) => sum + parseFloat(p.allocatedPrincipal.toString()),
        0
      );
      const totalUnallocated = payments.reduce(
        (sum, p) => sum + parseFloat(p.unallocatedAmount.toString()),
        0
      );

      expect(totalAllocatedPrincipal).toBe(10000);
      expect(totalUnallocated).toBe(5000);
    });
  });
});
