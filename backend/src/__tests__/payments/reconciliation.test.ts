import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { TenantModel } from '../../modules/tenants/tenant.model.js';
import { UserModel } from '../../modules/users/user.model.js';
import { PersonModel } from '../../modules/persons/person.model.js';
import { LoanModel } from '../../modules/loans/loan.model.js';
import { RepaymentScheduleModel } from '../../modules/loans/repayment-schedule.model.js';
import { PaymentModel } from '../../modules/payments/payment.model.js';
import { PaymentScheduleAllocationModel } from '../../modules/payments/payment-schedule-allocation.model.js';
import { TenantStatus } from '../../modules/tenants/tenant.types.js';
import { UserRole, UserStatus } from '../../modules/users/user.types.js';
import { PersonStatus, PersonType } from '../../modules/persons/person.types.js';
import { LoanType, InterestCalculationMethod, LoanStatus, PaymentFrequency } from '../../modules/loans/loan.types.js';
import { PaymentMethod } from '../../modules/payments/payment.types.js';
import { LoanService } from '../../modules/loans/loan.service.js';
import { PaymentService } from '../../modules/payments/payment.service.js';
import { ReconciliationService } from '../../modules/payments/reconciliation.service.js';
import { toDecimal128 } from '../../common/utils/money.js';

describe('Module 7 Payment Management — Financial Reconciliation Suite', () => {
  let tenantId: Types.ObjectId;
  let userId: string;
  let loanId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/loan-manager-test');
    }
  });

  beforeEach(async () => {
    await TenantModel.deleteMany({});
    await UserModel.deleteMany({});
    await PersonModel.deleteMany({});
    await LoanModel.deleteMany({});
    await RepaymentScheduleModel.deleteMany({});
    await PaymentModel.deleteMany({});
    await PaymentScheduleAllocationModel.deleteMany({});

    const tenant = await TenantModel.create({
      name: 'Reconciliation Lending',
      slug: 'reconcile-lending',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      country: 'IN',
      status: TenantStatus.ACTIVE
    });
    tenantId = tenant._id;

    const user = await UserModel.create({
      tenantId,
      email: 'admin@reconcile.com',
      passwordHash: 'dummy',
      role: UserRole.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });
    userId = user._id.toString();

    const borrower = await PersonModel.create({
      tenantId,
      type: PersonType.INDIVIDUAL,
      firstName: 'Karan',
      lastName: 'Mehra',
      phone: '+91 98765 33333',
      normalizedPhone: '+919876533333',
      status: PersonStatus.ACTIVE
    });

    const lender = await PersonModel.create({
      tenantId,
      type: PersonType.INDIVIDUAL,
      firstName: 'Pooja',
      lastName: 'Hegde',
      phone: '+91 98765 44444',
      normalizedPhone: '+919876544444',
      status: PersonStatus.ACTIVE
    });

    const loanResult = await LoanService.createLoan(
      tenantId,
      {
        lenderPersonId: lender._id.toString(),
        borrowerPersonId: borrower._id.toString(),
        loanType: LoanType.EMI,
        principalAmount: 60000,
        interestRate: 10,
        interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
        termMonths: 6,
        startDate: '2026-01-01',
        firstDueDate: '2026-02-01',
        paymentFrequency: PaymentFrequency.MONTHLY
      },
      userId,
      LoanStatus.ACTIVE
    );
    loanId = loanResult.loan.id;
  });

  it('should verify that a loan with posted payments is fully reconciled', async () => {
    // Post two payments
    await PaymentService.createPayment(
      tenantId,
      {
        loanId,
        amount: 10295,
        paymentDate: '2026-02-01',
        paymentMethod: PaymentMethod.BANK_TRANSFER
      },
      userId
    );

    await PaymentService.createPayment(
      tenantId,
      {
        loanId,
        amount: 5000,
        paymentDate: '2026-03-01',
        paymentMethod: PaymentMethod.UPI
      },
      userId
    );

    const report = await ReconciliationService.reconcileLoanFinancials(tenantId, loanId);

    expect(report.isReconciled).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
    expect(parseFloat(report.metrics.loanTotalPaid)).toBeCloseTo(15295, 1);
    expect(parseFloat(report.metrics.sumPostedAllocatedTotal)).toBeCloseTo(15295, 1);
    expect(report.metrics.postedPaymentCount).toBe(2);
  });

  it('should detect discrepancies if loan totalPaid is artificially modified out of band', async () => {
    // Post payment
    await PaymentService.createPayment(
      tenantId,
      {
        loanId,
        amount: 10000,
        paymentDate: '2026-02-01',
        paymentMethod: PaymentMethod.CASH
      },
      userId
    );

    // Corrupt loan document out of band
    await LoanModel.updateOne(
      { _id: loanId },
      { $set: { totalPaid: toDecimal128(99999) } }
    );

    const report = await ReconciliationService.reconcileLoanFinancials(tenantId, loanId);

    expect(report.isReconciled).toBe(false);
    expect(report.discrepancies.some((d) => d.includes('totalPaid'))).toBe(true);
  });

  it('should run tenant-wide reconciliation and return summary report', async () => {
    const tenantReport = await ReconciliationService.reconcileTenantFinancials(tenantId);

    expect(tenantReport.isReconciled).toBe(true);
    expect(tenantReport.totalLoansChecked).toBe(1);
    expect(tenantReport.unreconciledLoansCount).toBe(0);
  });
});
