import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { env } from '../../config/env.js';
import {
  TenantModel,
  UserModel,
  PersonModel,
  LoanModel,
  RepaymentScheduleModel,
  PaymentModel,
  NotificationModel,
  UserRole,
  PersonType,
  LoanType,
  InterestCalculationMethod,
  PaymentFrequency,
  PaymentMethod,
  NotificationChannel
} from '../../modules/models.js';
import { toDecimal128 } from '../../common/utils/money.js';

describe('Module 2 - Database Models & Schema Validation Suite', () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  });

  describe('Tenant Model', () => {
    it('should create Tenant with default INR currency and Asia/Kolkata timezone', async () => {
      const tenant = new TenantModel({
        name: 'Acme Financial Services',
        slug: `acme-${Date.now()}`
      });
      await tenant.save();

      expect(tenant._id).toBeDefined();
      expect(tenant.currency).toBe('INR');
      expect(tenant.timezone).toBe('Asia/Kolkata');
      expect(tenant.status).toBe('ACTIVE');
    });

    it('should enforce unique slug across tenants', async () => {
      const slug = `unique-slug-${Date.now()}`;
      const tenant1 = new TenantModel({ name: 'Tenant 1', slug });
      await tenant1.save();

      const tenant2 = new TenantModel({ name: 'Tenant 2', slug });
      await expect(tenant2.save()).rejects.toThrow();
    });
  });

  describe('User Model', () => {
    it('should enforce globally unique email for User', async () => {
      const email = `test-${Date.now()}@example.com`;
      const tenantId = new Types.ObjectId();

      const user1 = new UserModel({
        tenantId,
        email,
        passwordHash: 'dummyhash',
        role: UserRole.LOAN_OFFICER
      });
      await user1.save();

      const user2 = new UserModel({
        tenantId: new Types.ObjectId(),
        email,
        passwordHash: 'dummyhash',
        role: UserRole.TENANT_ADMIN
      });
      await expect(user2.save()).rejects.toThrow();
    });
  });

  describe('Person Model Name Auto-Generation', () => {
    it('should auto-generate displayName from first, middle, last name for INDIVIDUAL', async () => {
      const tenantId = new Types.ObjectId();
      const person = new PersonModel({
        tenantId,
        type: PersonType.INDIVIDUAL,
        firstName: 'Rajesh',
        middleName: 'Kumar',
        lastName: 'Sharma',
        phone: '+91 98765 43210'
      });
      await person.save();

      expect(person._id).toBeDefined();
      expect(person.displayName).toBe('Rajesh Kumar Sharma');
    });

    it('should auto-generate displayName from organizationName for ORGANIZATION', async () => {
      const tenantId = new Types.ObjectId();
      const org = new PersonModel({
        tenantId,
        type: PersonType.ORGANIZATION,
        organizationName: 'Enterprise Global Corp',
        phone: '+91 99999 88888'
      });
      await org.save();

      expect(org._id).toBeDefined();
      expect(org.displayName).toBe('Enterprise Global Corp');
      expect(org.firstName).toBeUndefined();
    });
  });

  describe('Loan Model & Participant Validation', () => {
    it('should fail validation when lenderId equals borrowerId', async () => {
      const tenantId = new Types.ObjectId();
      const samePersonId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const loan = new LoanModel({
        tenantId,
        loanNumber: `LN-${Date.now()}`,
        borrowerPersonId: samePersonId,
        lenderPersonId: samePersonId, // Invalid: same Person!
        principalAmount: toDecimal128(100000),
        interestRate: toDecimal128(12.5),
        loanType: LoanType.EMI,
        interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
        termMonths: 12,
        startDate: new Date(),
        firstDueDate: new Date(),
        paymentFrequency: PaymentFrequency.MONTHLY,
        createdBy: userId
      });

      await expect(loan.save()).rejects.toThrow('Lender and Borrower cannot be the same Person');
    });

    it('should snapshot loan principal amount as Decimal128', async () => {
      const tenantId = new Types.ObjectId();
      const borrowerPersonId = new Types.ObjectId();
      const lenderPersonId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const loan = new LoanModel({
        tenantId,
        loanNumber: `LN-${Date.now()}`,
        borrowerPersonId,
        lenderPersonId,
        principalAmount: toDecimal128(50000),
        interestRate: toDecimal128(10),
        loanType: LoanType.EMI,
        interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
        termMonths: 6,
        startDate: new Date(),
        firstDueDate: new Date(),
        paymentFrequency: PaymentFrequency.MONTHLY,
        createdBy: userId
      });
      await loan.save();

      expect(loan.loanType).toBe(LoanType.EMI);
      expect(loan.principalAmount.toString()).toBe('50000.0000');
    });
  });

  describe('Notification Model Recipient Validation', () => {
    it('should fail validation if neither recipientPersonId nor recipientUserId is provided', async () => {
      const tenantId = new Types.ObjectId();
      const notification = new NotificationModel({
        tenantId,
        channel: NotificationChannel.EMAIL,
        title: 'Payment Reminder',
        message: 'Your payment is due soon'
      });

      await expect(notification.save()).rejects.toThrow('Notification must have at least one recipient');
    });

    it('should pass validation when recipientPersonId is provided', async () => {
      const tenantId = new Types.ObjectId();
      const recipientPersonId = new Types.ObjectId();

      const notification = new NotificationModel({
        tenantId,
        recipientPersonId,
        channel: NotificationChannel.SMS,
        title: 'SMS Alert',
        message: 'Payment received'
      });
      await notification.save();

      expect(notification._id).toBeDefined();
    });
  });

  describe('RepaymentSchedule & Payment Relationship', () => {
    it('should support multiple Payments allocated to a single RepaymentSchedule', async () => {
      const tenantId = new Types.ObjectId();
      const loanId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const schedule = new RepaymentScheduleModel({
        tenantId,
        loanId,
        installmentNumber: 1,
        dueDate: new Date(),
        openingPrincipal: toDecimal128(10000),
        scheduledPrincipal: toDecimal128(10000),
        scheduledInterest: toDecimal128(1000),
        scheduledAmount: toDecimal128(11000),
        remainingAmount: toDecimal128(11000)
      });
      await schedule.save();

      const payment1 = new PaymentModel({
        tenantId,
        loanId,
        scheduleId: schedule._id,
        paymentNumber: `PMT-1-${Date.now()}`,
        amount: toDecimal128(5000),
        principalComponent: toDecimal128(4500),
        interestComponent: toDecimal128(500),
        paymentMethod: PaymentMethod.UPI,
        recordedById: userId
      });
      await payment1.save();

      const payment2 = new PaymentModel({
        tenantId,
        loanId,
        scheduleId: schedule._id,
        paymentNumber: `PMT-2-${Date.now()}`,
        amount: toDecimal128(6000),
        principalComponent: toDecimal128(5500),
        interestComponent: toDecimal128(500),
        paymentMethod: PaymentMethod.CASH,
        recordedById: userId
      });
      await payment2.save();

      expect(payment1.scheduleId?.toString()).toBe(schedule._id?.toString());
      expect(payment2.scheduleId?.toString()).toBe(schedule._id?.toString());
    });
  });
});
