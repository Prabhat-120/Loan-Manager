import { Types } from 'mongoose';
import { RepaymentScheduleModel } from '../loans/repayment-schedule.model.js';
import { LoanModel } from '../loans/loan.model.js';
import { ScheduleStatus } from '../loans/repayment-schedule.types.js';
import { LoanStatus } from '../loans/loan.types.js';
import { toDecimal } from '../../common/utils/money.js';

export class OverdueService {
  /**
   * Identifies and marks overdue schedules for a specific loan
   */
  static async evaluateLoanOverdue(
    tenantId: Types.ObjectId | string,
    loanId: Types.ObjectId | string,
    asOfDate: Date = new Date(),
    session?: any
  ): Promise<{ overdueCount: number; updated: boolean }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const loanObjectId = new Types.ObjectId(loanId);

    const schedules = await RepaymentScheduleModel.find({
      tenantId: tenantObjectId,
      loanId: loanObjectId
    })
      .session(session || null)
      .sort({ installmentNumber: 1 });

    let overdueCount = 0;
    let anyScheduleStatusChanged = false;

    for (const schedule of schedules) {
      const remainingAmount = toDecimal(schedule.remainingAmount);
      const isPastDue = new Date(schedule.dueDate).getTime() < asOfDate.getTime();

      if (remainingAmount.gt(0.0001) && isPastDue) {
        overdueCount++;
        if (schedule.status !== ScheduleStatus.OVERDUE) {
          schedule.status = ScheduleStatus.OVERDUE;
          await schedule.save({ session });
          anyScheduleStatusChanged = true;
        }
      } else if (schedule.status === ScheduleStatus.OVERDUE && (!isPastDue || remainingAmount.lte(0.0001))) {
        if (remainingAmount.lte(0.0001)) {
          schedule.status = ScheduleStatus.PAID;
        } else {
          const paidAmount = toDecimal(schedule.paidAmount);
          schedule.status = paidAmount.gt(0) ? ScheduleStatus.PARTIALLY_PAID : ScheduleStatus.PENDING;
        }
        await schedule.save({ session });
        anyScheduleStatusChanged = true;
      }
    }

    // Check Loan status
    const loan = await LoanModel.findOne({ _id: loanObjectId, tenantId: tenantObjectId }).session(session || null);
    if (loan && loan.status !== LoanStatus.CLOSED && loan.status !== LoanStatus.CANCELLED && loan.status !== LoanStatus.DRAFT) {
      if (overdueCount > 0 && loan.status !== LoanStatus.OVERDUE) {
        loan.status = LoanStatus.OVERDUE;
        await loan.save({ session });
      } else if (overdueCount === 0 && loan.status === LoanStatus.OVERDUE) {
        const totalPaid = toDecimal(loan.totalPaid);
        loan.status = totalPaid.gt(0) ? LoanStatus.PARTIALLY_PAID : LoanStatus.ACTIVE;
        await loan.save({ session });
      }
    }

    return { overdueCount, updated: anyScheduleStatusChanged };
  }

  /**
   * Evaluates all active loans in a tenant for overdue schedules
   */
  static async evaluateTenantOverdue(
    tenantId: Types.ObjectId | string,
    asOfDate: Date = new Date()
  ): Promise<{ loansChecked: number; overdueLoansFound: number }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const activeLoans = await LoanModel.find({
      tenantId: tenantObjectId,
      status: { $in: [LoanStatus.ACTIVE, LoanStatus.PARTIALLY_PAID, LoanStatus.OVERDUE] }
    });

    let overdueLoansFound = 0;
    for (const loan of activeLoans) {
      const { overdueCount } = await this.evaluateLoanOverdue(tenantObjectId, loan._id!, asOfDate);
      if (overdueCount > 0) {
        overdueLoansFound++;
      }
    }

    return { loansChecked: activeLoans.length, overdueLoansFound };
  }
}
