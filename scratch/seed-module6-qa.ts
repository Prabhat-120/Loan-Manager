import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { TenantModel } from '../backend/src/modules/tenants/tenant.model.js';
import { SubscriptionModel } from '../backend/src/modules/tenants/subscription.model.js';
import { UserModel } from '../backend/src/modules/users/user.model.js';
import { PersonModel } from '../backend/src/modules/persons/person.model.js';
import { LoanModel } from '../backend/src/modules/loans/loan.model.js';
import { RepaymentScheduleModel } from '../backend/src/modules/loans/repayment-schedule.model.js';
import { AuditLogModel } from '../backend/src/modules/audit/audit-log.model.js';
import { TenantStatus } from '../backend/src/modules/tenants/tenant.types.js';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from '../backend/src/modules/tenants/subscription.types.js';
import { UserRole, UserStatus } from '../backend/src/modules/users/user.types.js';
import { PersonStatus, PersonType } from '../backend/src/modules/persons/person.types.js';
import { LoanService } from '../backend/src/modules/loans/loan.service.js';
import { LoanType, InterestCalculationMethod, InterestRateType, PaymentFrequency, LoanStatus } from '../backend/src/modules/loans/loan.types.js';

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/loan-manager');
  console.log('Connected to MongoDB');

  // Clear data
  await TenantModel.deleteMany({});
  await SubscriptionModel.deleteMany({});
  await UserModel.deleteMany({});
  await PersonModel.deleteMany({});
  await LoanModel.deleteMany({});
  await RepaymentScheduleModel.deleteMany({});
  await AuditLogModel.deleteMany({});

  const passwordHash = await bcrypt.hash('TenantPass123!', 10);
  const platformPasswordHash = await bcrypt.hash('PlatformPass123!', 10);

  // 1. Platform Owner
  await UserModel.create({
    email: 'platform@saas.com',
    passwordHash: platformPasswordHash,
    role: UserRole.PLATFORM_OWNER,
    status: UserStatus.ACTIVE,
    firstLogin: false
  });

  // 2. Tenant Alpha
  const tenantAlpha = await TenantModel.create({
    name: 'Alpha Capital',
    slug: 'alpha-capital',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    country: 'IN',
    status: TenantStatus.ACTIVE
  });

  await SubscriptionModel.create({
    tenantId: tenantAlpha._id,
    plan: SubscriptionPlan.STARTER,
    status: SubscriptionStatus.ACTIVE,
    billingCycle: BillingCycle.MONTHLY,
    amount: 999,
    currency: 'INR',
    startDate: new Date(),
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    limits: { maxUsers: 10, maxActiveLoans: 50, maxPeople: 200 }
  });

  // Users in Alpha
  const ownerAlpha = await UserModel.create({
    tenantId: tenantAlpha._id,
    email: 'owner@alpha.com',
    passwordHash,
    role: UserRole.TENANT_OWNER,
    status: UserStatus.ACTIVE,
    firstLogin: false
  });

  await UserModel.create([
    { tenantId: tenantAlpha._id, email: 'admin@alpha.com', passwordHash, role: UserRole.TENANT_ADMIN, status: UserStatus.ACTIVE, firstLogin: false },
    { tenantId: tenantAlpha._id, email: 'officer@alpha.com', passwordHash, role: UserRole.LOAN_OFFICER, status: UserStatus.ACTIVE, firstLogin: false },
    { tenantId: tenantAlpha._id, email: 'readonly@alpha.com', passwordHash, role: UserRole.READ_ONLY, status: UserStatus.ACTIVE, firstLogin: false }
  ]);

  // People in Alpha
  const personA = await PersonModel.create({
    tenantId: tenantAlpha._id,
    type: PersonType.INDIVIDUAL,
    displayName: 'Anil Sharma',
    firstName: 'Anil',
    lastName: 'Sharma',
    phone: '+919876543210',
    normalizedPhone: '+919876543210',
    status: PersonStatus.ACTIVE
  });

  const personB = await PersonModel.create({
    tenantId: tenantAlpha._id,
    type: PersonType.INDIVIDUAL,
    displayName: 'Bina Gupta',
    firstName: 'Bina',
    lastName: 'Gupta',
    phone: '+919876543211',
    normalizedPhone: '+919876543211',
    status: PersonStatus.ACTIVE
  });

  const personC = await PersonModel.create({
    tenantId: tenantAlpha._id,
    type: PersonType.INDIVIDUAL,
    displayName: 'Chetan Verma',
    firstName: 'Chetan',
    lastName: 'Verma',
    phone: '+919876543212',
    normalizedPhone: '+919876543212',
    status: PersonStatus.ACTIVE
  });

  // Create sample loans
  // Loan 1: Anil gives to Bina (EMI, 12 months, 100k @ 12%)
  const loan1 = await LoanService.createLoan(
    tenantAlpha._id,
    {
      lenderPersonId: personA._id.toString(),
      borrowerPersonId: personB._id.toString(),
      loanType: LoanType.EMI,
      principalAmount: '100000',
      interestRate: '12',
      interestRateType: InterestRateType.PERCENTAGE_PER_YEAR,
      interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
      termMonths: 12,
      startDate: new Date('2026-01-01'),
      firstDueDate: new Date('2026-02-01'),
      paymentFrequency: PaymentFrequency.MONTHLY,
      notes: 'Sample 12-month reducing balance EMI loan'
    },
    ownerAlpha._id.toString(),
    LoanStatus.ACTIVE
  );

  // Loan 2: Chetan gives to Anil (Interest-Only, 6 months, 50k @ 12%)
  const loan2 = await LoanService.createLoan(
    tenantAlpha._id,
    {
      lenderPersonId: personC._id.toString(),
      borrowerPersonId: personA._id.toString(),
      loanType: LoanType.INTEREST_ONLY,
      principalAmount: '50000',
      interestRate: '12',
      interestRateType: InterestRateType.PERCENTAGE_PER_YEAR,
      interestCalculationMethod: InterestCalculationMethod.FLAT,
      termMonths: 6,
      startDate: new Date('2026-01-01'),
      firstDueDate: new Date('2026-02-01'),
      paymentFrequency: PaymentFrequency.MONTHLY,
      notes: 'Sample interest-only loan with monthly interest and bullet principal'
    },
    ownerAlpha._id.toString(),
    LoanStatus.ACTIVE
  );

  console.log('Seeded successfully:');
  console.log('Loan 1 Number:', loan1.loan.loanNumber);
  console.log('Loan 2 Number:', loan2.loan.loanNumber);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
