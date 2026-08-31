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
import { TenantStatus } from '../../modules/tenants/tenant.types.js';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from '../../modules/tenants/subscription.types.js';
import { UserRole, UserStatus } from '../../modules/users/user.types.js';
import { PersonStatus, PersonType } from '../../modules/persons/person.types.js';
import { LoanType, InterestCalculationMethod } from '../../modules/loans/loan.types.js';

describe('Repayment Schedule Service & API Tests', () => {
  let tenantAId: Types.ObjectId;
  let tenantBId: Types.ObjectId;
  let ownerTokenA: string;
  let ownerTokenB: string;
  let loanAId: string;

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
      cancelAtPeriodEnd: false
    });

    const tenantB = await TenantModel.create({
      name: 'Beta Lending',
      slug: 'beta-lending',
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
      cancelAtPeriodEnd: false
    });

    const passwordHash = await bcrypt.hash('Password123!', 10);

    await UserModel.create([
      { tenantId: tenantAId, email: 'owner@alpha.com', passwordHash, role: UserRole.TENANT_OWNER, status: UserStatus.ACTIVE, firstLogin: false },
      { tenantId: tenantBId, email: 'owner@beta.com', passwordHash, role: UserRole.TENANT_OWNER, status: UserStatus.ACTIVE, firstLogin: false }
    ]);

    const p1 = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      displayName: 'Alice Lender',
      firstName: 'Alice',
      lastName: 'Lender',
      phone: '+919876543210',
      normalizedPhone: '+919876543210',
      status: PersonStatus.ACTIVE
    });

    const p2 = await PersonModel.create({
      tenantId: tenantAId,
      type: PersonType.INDIVIDUAL,
      displayName: 'Bob Borrower',
      firstName: 'Bob',
      lastName: 'Borrower',
      phone: '+919876543211',
      normalizedPhone: '+919876543211',
      status: PersonStatus.ACTIVE
    });

    const loginA = await request(app).post('/api/v1/auth/login').send({ email: 'owner@alpha.com', password: 'Password123!' });
    ownerTokenA = loginA.body.data.accessToken;

    const loginB = await request(app).post('/api/v1/auth/login').send({ email: 'owner@beta.com', password: 'Password123!' });
    ownerTokenB = loginB.body.data.accessToken;

    // Create 6-month EMI Loan
    const loanRes = await request(app)
      .post('/api/v1/tenant/loans')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        lenderPersonId: p1._id.toString(),
        borrowerPersonId: p2._id.toString(),
        loanType: LoanType.EMI,
        principalAmount: '60000',
        interestRate: '12',
        interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
        termMonths: 6,
        startDate: '2026-01-01',
        firstDueDate: '2026-02-01'
      });

    loanAId = loanRes.body.data.loan.id;
  });

  it('fetches ordered repayment schedule with all installment fields for Tenant A', async () => {
    const res = await request(app)
      .get(`/api/v1/tenant/loans/${loanAId}/schedule`)
      .set('Authorization', `Bearer ${ownerTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(6);

    const first = res.body.data[0];
    expect(first.installmentNumber).toBe(1);
    expect(first.status).toBe('PENDING');
    expect(first.openingPrincipal).toBe('60000.00');
    expect(first.scheduledAmount).toBeDefined();
    expect(first.scheduledPrincipal).toBeDefined();
    expect(first.scheduledInterest).toBeDefined();
    expect(first.remainingAmount).toBe(first.scheduledAmount);

    const last = res.body.data[5];
    expect(last.installmentNumber).toBe(6);
  });

  it('rejects cross-tenant access to repayment schedule (Tenant B cannot read Tenant A schedule)', async () => {
    const res = await request(app)
      .get(`/api/v1/tenant/loans/${loanAId}/schedule`)
      .set('Authorization', `Bearer ${ownerTokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
