import { Types } from 'mongoose';
import Decimal from 'decimal.js';
import { toDecimal } from '../../common/utils/money.js';
import { ScheduleStatus } from '../loans/repayment-schedule.types.js';

export interface ScheduleAllocationItem {
  scheduleId: Types.ObjectId | string;
  installmentNumber: number;
  dueDate: Date;
  scheduledPrincipal: Decimal;
  scheduledInterest: Decimal;
  scheduledAmount: Decimal;
  previousPaidPrincipal: Decimal;
  previousPaidInterest: Decimal;
  previousPaidAmount: Decimal;
  previousRemainingAmount: Decimal;
  allocatedInterest: Decimal;
  allocatedPrincipal: Decimal;
  allocatedTotal: Decimal;
  newPaidPrincipal: Decimal;
  newPaidInterest: Decimal;
  newPaidAmount: Decimal;
  newRemainingAmount: Decimal;
  newStatus: ScheduleStatus;
}

export interface AllocationEngineResult {
  paymentAmount: Decimal;
  allocatedInterest: Decimal;
  allocatedPrincipal: Decimal;
  unallocatedAmount: Decimal;
  scheduleAllocations: ScheduleAllocationItem[];
  allSchedulesSatisfied: boolean;
}

export interface InputSchedule {
  _id: Types.ObjectId | string;
  installmentNumber: number;
  dueDate: Date;
  scheduledPrincipal: any;
  scheduledInterest: any;
  scheduledAmount: any;
  paidPrincipal?: any;
  paidInterest?: any;
  paidAmount?: any;
  remainingAmount?: any;
  status?: ScheduleStatus;
}

export class PaymentAllocationService {
  /**
   * Pure allocation engine applying OLDEST_DUE_FIRST strategy
   */
  static allocatePayment(
    paymentAmountInput: number | string | Decimal | Types.Decimal128,
    schedules: InputSchedule[]
  ): AllocationEngineResult {
    const paymentAmount = toDecimal(paymentAmountInput);
    if (paymentAmount.lte(0)) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Sort schedules by installmentNumber / dueDate ascending
    const sortedSchedules = [...schedules].sort(
      (a, b) => a.installmentNumber - b.installmentNumber
    );

    let remainingPayment = new Decimal(paymentAmount);
    let totalAllocatedInterest = new Decimal(0);
    let totalAllocatedPrincipal = new Decimal(0);
    const scheduleAllocations: ScheduleAllocationItem[] = [];

    for (const schedule of sortedSchedules) {
      if (remainingPayment.lte(0)) {
        break;
      }

      const scheduledPrincipal = toDecimal(schedule.scheduledPrincipal);
      const scheduledInterest = toDecimal(schedule.scheduledInterest);
      const scheduledAmount = toDecimal(schedule.scheduledAmount);

      const prevPaidPrincipal = schedule.paidPrincipal ? toDecimal(schedule.paidPrincipal) : new Decimal(0);
      const prevPaidInterest = schedule.paidInterest ? toDecimal(schedule.paidInterest) : new Decimal(0);
      const prevPaidAmount = schedule.paidAmount ? toDecimal(schedule.paidAmount) : prevPaidPrincipal.plus(prevPaidInterest);
      const prevRemainingAmount = schedule.remainingAmount !== undefined
        ? toDecimal(schedule.remainingAmount)
        : scheduledAmount.minus(prevPaidAmount);

      // If this schedule is already fully satisfied, skip to next
      if (prevRemainingAmount.lte(0)) {
        continue;
      }

      // 1. Outstanding interest for this installment
      const outstandingInterestOnInstallment = Decimal.max(0, scheduledInterest.minus(prevPaidInterest));
      const allocInterest = Decimal.min(remainingPayment, outstandingInterestOnInstallment);
      remainingPayment = remainingPayment.minus(allocInterest);
      totalAllocatedInterest = totalAllocatedInterest.plus(allocInterest);

      // 2. Outstanding principal for this installment
      const outstandingPrincipalOnInstallment = Decimal.max(0, scheduledPrincipal.minus(prevPaidPrincipal));
      const allocPrincipal = Decimal.min(remainingPayment, outstandingPrincipalOnInstallment);
      remainingPayment = remainingPayment.minus(allocPrincipal);
      totalAllocatedPrincipal = totalAllocatedPrincipal.plus(allocPrincipal);

      const allocTotal = allocInterest.plus(allocPrincipal);

      // Calculate updated schedule numbers
      const newPaidInterest = prevPaidInterest.plus(allocInterest);
      const newPaidPrincipal = prevPaidPrincipal.plus(allocPrincipal);
      const newPaidAmount = prevPaidAmount.plus(allocTotal);
      const newRemainingAmount = Decimal.max(0, scheduledAmount.minus(newPaidAmount));

      let newStatus: ScheduleStatus;
      if (newRemainingAmount.lte(0.0001)) {
        newStatus = ScheduleStatus.PAID;
      } else if (newPaidAmount.gt(0)) {
        newStatus = ScheduleStatus.PARTIALLY_PAID;
      } else {
        newStatus = schedule.status || ScheduleStatus.PENDING;
      }

      scheduleAllocations.push({
        scheduleId: schedule._id,
        installmentNumber: schedule.installmentNumber,
        dueDate: new Date(schedule.dueDate),
        scheduledPrincipal,
        scheduledInterest,
        scheduledAmount,
        previousPaidPrincipal: prevPaidPrincipal,
        previousPaidInterest: prevPaidInterest,
        previousPaidAmount: prevPaidAmount,
        previousRemainingAmount: prevRemainingAmount,
        allocatedInterest: allocInterest,
        allocatedPrincipal: allocPrincipal,
        allocatedTotal: allocTotal,
        newPaidPrincipal,
        newPaidInterest,
        newPaidAmount,
        newRemainingAmount,
        newStatus
      });
    }

    const unallocatedAmount = remainingPayment;
    const allSchedulesSatisfied = unallocatedAmount.gte(0) &&
      sortedSchedules.every(s => {
        const found = scheduleAllocations.find(a => a.scheduleId.toString() === s._id.toString());
        if (found) {
          return found.newRemainingAmount.lte(0.0001);
        }
        const rem = s.remainingAmount ? toDecimal(s.remainingAmount) : new Decimal(0);
        return rem.lte(0.0001);
      });

    return {
      paymentAmount,
      allocatedInterest: totalAllocatedInterest,
      allocatedPrincipal: totalAllocatedPrincipal,
      unallocatedAmount,
      scheduleAllocations,
      allSchedulesSatisfied
    };
  }
}
