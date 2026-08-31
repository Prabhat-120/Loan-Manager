import { Types } from 'mongoose';
import Decimal from 'decimal.js';
import { LoanModel } from '../loans/loan.model.js';
import { RepaymentScheduleModel } from '../loans/repayment-schedule.model.js';
import { PaymentModel } from './payment.model.js';
import { PaymentScheduleAllocationModel } from './payment-schedule-allocation.model.js';
import { PaymentStatus } from './payment.types.js';
import { toDecimal } from '../../common/utils/money.js';
import { NotFoundError } from '../../common/errors/app-error.js';

export interface LoanReconciliationResult {
  loanId: string;
  loanNumber: string;
  isReconciled: boolean;
  discrepancies: string[];
  metrics: {
    loanTotalPaid: string;
    sumPostedAllocatedTotal: string;
    sumPostedInterestAllocated: string;
    sumPostedPrincipalAllocated: string;
    sumPostedUnallocated: string;
    loanOutstandingPrincipal: string;
    loanOutstandingInterest: string;
    expectedOutstandingPrincipal: string;
    expectedOutstandingInterest: string;
    postedPaymentCount: number;
    reversedPaymentCount: number;
    scheduleCount: number;
  };
}

export interface TenantReconciliationResult {
  tenantId: string;
  isReconciled: boolean;
  totalLoansChecked: number;
  unreconciledLoansCount: number;
  loanReports: LoanReconciliationResult[];
}

export class ReconciliationService {
  /**
   * Diagnostic verification that authoritative loan & schedule financials match POSTED payments
   */
  static async reconcileLoanFinancials(
    tenantId: Types.ObjectId | string,
    loanId: Types.ObjectId | string
  ): Promise<LoanReconciliationResult> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const loanObjectId = new Types.ObjectId(loanId);

    const loan = await LoanModel.findOne({ _id: loanObjectId, tenantId: tenantObjectId });
    if (!loan) {
      throw new NotFoundError('Loan not found in this tenant');
    }

    const discrepancies: string[] = [];

    // 1. Fetch payments
    const payments = await PaymentModel.find({ tenantId: tenantObjectId, loanId: loanObjectId });
    const postedPayments = payments.filter((p) => p.status === PaymentStatus.POSTED);
    const reversedPayments = payments.filter((p) => p.status === PaymentStatus.REVERSED);

    // Sum posted payment values
    let sumPostedInterest = new Decimal(0);
    let sumPostedPrincipal = new Decimal(0);
    let sumPostedUnallocated = new Decimal(0);
    let sumPostedTotalPaid = new Decimal(0);

    for (const pmt of postedPayments) {
      const pmtAmount = toDecimal(pmt.amount);
      const pmtInterest = toDecimal(pmt.allocatedInterest);
      const pmtPrincipal = toDecimal(pmt.allocatedPrincipal);
      const pmtUnalloc = toDecimal(pmt.unallocatedAmount);

      // Verify that internal payment allocation components match payment amount
      if (!pmtInterest.plus(pmtPrincipal).plus(pmtUnalloc).equals(pmtAmount)) {
        discrepancies.push(
          `Payment ${pmt.paymentNumber} internal sum mismatch: interest(${pmtInterest}) + principal(${pmtPrincipal}) + unallocated(${pmtUnalloc}) != amount(${pmtAmount})`
        );
      }

      sumPostedInterest = sumPostedInterest.plus(pmtInterest);
      sumPostedPrincipal = sumPostedPrincipal.plus(pmtPrincipal);
      sumPostedUnallocated = sumPostedUnallocated.plus(pmtUnalloc);
      sumPostedTotalPaid = sumPostedTotalPaid.plus(pmtInterest).plus(pmtPrincipal);
    }

    // 2. Compare with Loan aggregates
    const loanTotalPaid = toDecimal(loan.totalPaid);
    const loanOutstandingPrincipal = toDecimal(loan.outstandingPrincipal);
    const loanOutstandingInterest = toDecimal(loan.outstandingInterest);
    const loanPrincipalAmount = toDecimal(loan.principalAmount);
    const loanTotalInterest = toDecimal(loan.totalInterest);

    if (!loanTotalPaid.equals(sumPostedTotalPaid)) {
      discrepancies.push(
        `Loan totalPaid (${loanTotalPaid}) does not match sum of posted allocations (${sumPostedTotalPaid})`
      );
    }

    const expectedOutstandingPrincipal = Decimal.max(0, loanPrincipalAmount.minus(sumPostedPrincipal));
    if (!loanOutstandingPrincipal.equals(expectedOutstandingPrincipal)) {
      discrepancies.push(
        `Loan outstandingPrincipal (${loanOutstandingPrincipal}) does not match expected (${expectedOutstandingPrincipal})`
      );
    }

    const expectedOutstandingInterest = Decimal.max(0, loanTotalInterest.minus(sumPostedInterest));
    if (!loanOutstandingInterest.equals(expectedOutstandingInterest)) {
      discrepancies.push(
        `Loan outstandingInterest (${loanOutstandingInterest}) does not match expected (${expectedOutstandingInterest})`
      );
    }

    // 3. Verify schedules and schedule allocations
    const schedules = await RepaymentScheduleModel.find({
      tenantId: tenantObjectId,
      loanId: loanObjectId
    }).sort({ installmentNumber: 1 });

    const postedPaymentIds = postedPayments.map((p) => p._id);
    const scheduleAllocations = await PaymentScheduleAllocationModel.find({
      tenantId: tenantObjectId,
      loanId: loanObjectId,
      paymentId: { $in: postedPaymentIds }
    });

    // Check each schedule
    for (const schedule of schedules) {
      const schPaidPrincipal = toDecimal(schedule.paidPrincipal);
      const schPaidInterest = toDecimal(schedule.paidInterest);
      const schPaidAmount = toDecimal(schedule.paidAmount);
      const schRemaining = toDecimal(schedule.remainingAmount);
      const schTotalScheduled = toDecimal(schedule.scheduledAmount);

      if (schPaidPrincipal.lt(0) || schPaidInterest.lt(0) || schPaidAmount.lt(0)) {
        discrepancies.push(`Schedule installment #${schedule.installmentNumber} has negative paid amount`);
      }

      if (schPaidAmount.gt(schTotalScheduled)) {
        discrepancies.push(
          `Schedule installment #${schedule.installmentNumber} paidAmount (${schPaidAmount}) exceeds scheduledAmount (${schTotalScheduled})`
        );
      }

      const expectedRemaining = Decimal.max(0, schTotalScheduled.minus(schPaidAmount));
      if (!schRemaining.equals(expectedRemaining)) {
        discrepancies.push(
          `Schedule installment #${schedule.installmentNumber} remainingAmount (${schRemaining}) != scheduled - paid (${expectedRemaining})`
        );
      }

      // Sum allocations for this schedule
      const allocationsForSch = scheduleAllocations.filter(
        (sa) => sa.scheduleId.toString() === schedule._id!.toString()
      );
      let allocSumPrincipal = new Decimal(0);
      let allocSumInterest = new Decimal(0);
      for (const sa of allocationsForSch) {
        allocSumPrincipal = allocSumPrincipal.plus(toDecimal(sa.principalAmount));
        allocSumInterest = allocSumInterest.plus(toDecimal(sa.interestAmount));
      }

      if (!allocSumPrincipal.equals(schPaidPrincipal)) {
        discrepancies.push(
          `Schedule installment #${schedule.installmentNumber} paidPrincipal (${schPaidPrincipal}) != sum of posted allocations (${allocSumPrincipal})`
        );
      }

      if (!allocSumInterest.equals(schPaidInterest)) {
        discrepancies.push(
          `Schedule installment #${schedule.installmentNumber} paidInterest (${schPaidInterest}) != sum of posted allocations (${allocSumInterest})`
        );
      }
    }

    // Check for orphan allocations (allocations without matching payment or schedule)
    const allAllocations = await PaymentScheduleAllocationModel.find({
      tenantId: tenantObjectId,
      loanId: loanObjectId
    });
    for (const alloc of allAllocations) {
      const pmtExists = payments.some((p) => p._id!.toString() === alloc.paymentId.toString());
      if (!pmtExists) {
        discrepancies.push(`Orphan payment schedule allocation found: paymentId ${alloc.paymentId} does not exist`);
      }
      const schExists = schedules.some((s) => s._id!.toString() === alloc.scheduleId.toString());
      if (!schExists) {
        discrepancies.push(`Orphan payment schedule allocation found: scheduleId ${alloc.scheduleId} does not exist`);
      }
    }

    return {
      loanId: loan._id!.toString(),
      loanNumber: loan.loanNumber,
      isReconciled: discrepancies.length === 0,
      discrepancies,
      metrics: {
        loanTotalPaid: loanTotalPaid.toFixed(2),
        sumPostedAllocatedTotal: sumPostedTotalPaid.toFixed(2),
        sumPostedInterestAllocated: sumPostedInterest.toFixed(2),
        sumPostedPrincipalAllocated: sumPostedPrincipal.toFixed(2),
        sumPostedUnallocated: sumPostedUnallocated.toFixed(2),
        loanOutstandingPrincipal: loanOutstandingPrincipal.toFixed(2),
        loanOutstandingInterest: loanOutstandingInterest.toFixed(2),
        expectedOutstandingPrincipal: expectedOutstandingPrincipal.toFixed(2),
        expectedOutstandingInterest: expectedOutstandingInterest.toFixed(2),
        postedPaymentCount: postedPayments.length,
        reversedPaymentCount: reversedPayments.length,
        scheduleCount: schedules.length
      }
    };
  }

  /**
   * Diagnostic reconciliation for all loans in a tenant
   */
  static async reconcileTenantFinancials(
    tenantId: Types.ObjectId | string
  ): Promise<TenantReconciliationResult> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const loans = await LoanModel.find({ tenantId: tenantObjectId });

    const loanReports: LoanReconciliationResult[] = [];
    let unreconciledCount = 0;

    for (const loan of loans) {
      const report = await this.reconcileLoanFinancials(tenantObjectId, loan._id!);
      loanReports.push(report);
      if (!report.isReconciled) {
        unreconciledCount++;
      }
    }

    return {
      tenantId: tenantObjectId.toString(),
      isReconciled: unreconciledCount === 0,
      totalLoansChecked: loans.length,
      unreconciledLoansCount: unreconciledCount,
      loanReports
    };
  }
}
