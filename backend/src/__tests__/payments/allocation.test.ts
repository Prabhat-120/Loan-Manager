import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { PaymentAllocationService, InputSchedule } from '../../modules/payments/payment-allocation.service.js';
import { ScheduleStatus } from '../../modules/loans/repayment-schedule.types.js';

describe('PaymentAllocationService — Financial Allocation Suite', () => {
  // TEST 1 — Interest-only
  it('TEST 1: Interest-only payment satisfies interest without reducing principal', () => {
    const schedules: InputSchedule[] = [
      {
        _id: new Types.ObjectId(),
        installmentNumber: 1,
        dueDate: new Date('2026-04-01'),
        scheduledPrincipal: 0,
        scheduledInterest: 1000,
        scheduledAmount: 1000,
        paidPrincipal: 0,
        paidInterest: 0,
        paidAmount: 0,
        remainingAmount: 1000,
        status: ScheduleStatus.PENDING
      },
      {
        _id: new Types.ObjectId(),
        installmentNumber: 2,
        dueDate: new Date('2026-05-01'),
        scheduledPrincipal: 100000,
        scheduledInterest: 1000,
        scheduledAmount: 101000,
        paidPrincipal: 0,
        paidInterest: 0,
        paidAmount: 0,
        remainingAmount: 101000,
        status: ScheduleStatus.PENDING
      }
    ];

    const result = PaymentAllocationService.allocatePayment(1000, schedules);

    expect(result.allocatedInterest.toString()).toBe('1000');
    expect(result.allocatedPrincipal.toString()).toBe('0');
    expect(result.unallocatedAmount.toString()).toBe('0');
    expect(result.scheduleAllocations).toHaveLength(1);
    expect(result.scheduleAllocations[0].installmentNumber).toBe(1);
    expect(result.scheduleAllocations[0].newStatus).toBe(ScheduleStatus.PAID);
    expect(result.scheduleAllocations[0].newRemainingAmount.toString()).toBe('0');
  });

  // TEST 2 — Interest + principal
  it('TEST 2: Interest + principal allocation on single installment with excess to principal', () => {
    const schedules: InputSchedule[] = [
      {
        _id: new Types.ObjectId(),
        installmentNumber: 1,
        dueDate: new Date('2026-04-01'),
        scheduledPrincipal: 100000,
        scheduledInterest: 1000,
        scheduledAmount: 101000,
        paidPrincipal: 0,
        paidInterest: 0,
        paidAmount: 0,
        remainingAmount: 101000,
        status: ScheduleStatus.PENDING
      }
    ];

    const result = PaymentAllocationService.allocatePayment(6000, schedules);

    expect(result.allocatedInterest.toString()).toBe('1000');
    expect(result.allocatedPrincipal.toString()).toBe('5000');
    expect(result.unallocatedAmount.toString()).toBe('0');
    expect(result.scheduleAllocations[0].newPaidInterest.toString()).toBe('1000');
    expect(result.scheduleAllocations[0].newPaidPrincipal.toString()).toBe('5000');
    expect(result.scheduleAllocations[0].newPaidAmount.toString()).toBe('6000');
    expect(result.scheduleAllocations[0].newRemainingAmount.toString()).toBe('95000');
    expect(result.scheduleAllocations[0].newStatus).toBe(ScheduleStatus.PARTIALLY_PAID);
  });

  // TEST 3 — Partial interest
  it('TEST 3: Partial payment covers interest first before principal', () => {
    const schedules: InputSchedule[] = [
      {
        _id: new Types.ObjectId(),
        installmentNumber: 1,
        dueDate: new Date('2026-04-01'),
        scheduledPrincipal: 100000,
        scheduledInterest: 1000,
        scheduledAmount: 101000,
        paidPrincipal: 0,
        paidInterest: 0,
        paidAmount: 0,
        remainingAmount: 101000,
        status: ScheduleStatus.PENDING
      }
    ];

    const result = PaymentAllocationService.allocatePayment(500, schedules);

    expect(result.allocatedInterest.toString()).toBe('500');
    expect(result.allocatedPrincipal.toString()).toBe('0');
    expect(result.unallocatedAmount.toString()).toBe('0');
    expect(result.scheduleAllocations[0].newPaidInterest.toString()).toBe('500');
    expect(result.scheduleAllocations[0].newPaidPrincipal.toString()).toBe('0');
    expect(result.scheduleAllocations[0].newRemainingAmount.toString()).toBe('100500');
    expect(result.scheduleAllocations[0].newStatus).toBe(ScheduleStatus.PARTIALLY_PAID);
  });

  // TEST 4 — EMI installment
  it('TEST 4: EMI installment allocation matches interest and principal components', () => {
    const schedules: InputSchedule[] = [
      {
        _id: new Types.ObjectId(),
        installmentNumber: 1,
        dueDate: new Date('2026-04-01'),
        scheduledPrincipal: 8000,
        scheduledInterest: 1000,
        scheduledAmount: 9000,
        paidPrincipal: 0,
        paidInterest: 0,
        paidAmount: 0,
        remainingAmount: 9000,
        status: ScheduleStatus.PENDING
      },
      {
        _id: new Types.ObjectId(),
        installmentNumber: 2,
        dueDate: new Date('2026-05-01'),
        scheduledPrincipal: 8100,
        scheduledInterest: 900,
        scheduledAmount: 9000,
        paidPrincipal: 0,
        paidInterest: 0,
        paidAmount: 0,
        remainingAmount: 9000,
        status: ScheduleStatus.PENDING
      }
    ];

    const result = PaymentAllocationService.allocatePayment(9000, schedules);

    expect(result.allocatedInterest.toString()).toBe('1000');
    expect(result.allocatedPrincipal.toString()).toBe('8000');
    expect(result.unallocatedAmount.toString()).toBe('0');
    expect(result.scheduleAllocations).toHaveLength(1);
    expect(result.scheduleAllocations[0].installmentNumber).toBe(1);
    expect(result.scheduleAllocations[0].newStatus).toBe(ScheduleStatus.PAID);
  });

  // TEST 5 — Multiple installments oldest-due-first
  it('TEST 5: Payment large enough for multiple installments allocates in oldest-due-first order', () => {
    const schedules: InputSchedule[] = [
      {
        _id: new Types.ObjectId(),
        installmentNumber: 1,
        dueDate: new Date('2026-04-01'),
        scheduledPrincipal: 8000,
        scheduledInterest: 1000,
        scheduledAmount: 9000,
        paidPrincipal: 0,
        paidInterest: 0,
        paidAmount: 0,
        remainingAmount: 9000,
        status: ScheduleStatus.PENDING
      },
      {
        _id: new Types.ObjectId(),
        installmentNumber: 2,
        dueDate: new Date('2026-05-01'),
        scheduledPrincipal: 8100,
        scheduledInterest: 900,
        scheduledAmount: 9000,
        paidPrincipal: 0,
        paidInterest: 0,
        paidAmount: 0,
        remainingAmount: 9000,
        status: ScheduleStatus.PENDING
      }
    ];

    // Payment of 10,000 -> covers all 9,000 of Inst 1 (1,000 interest, 8,000 principal)
    // plus 1,000 on Inst 2 (900 interest, 100 principal)
    const result = PaymentAllocationService.allocatePayment(10000, schedules);

    expect(result.allocatedInterest.toString()).toBe('1900');
    expect(result.allocatedPrincipal.toString()).toBe('8100');
    expect(result.unallocatedAmount.toString()).toBe('0');
    expect(result.scheduleAllocations).toHaveLength(2);

    expect(result.scheduleAllocations[0].installmentNumber).toBe(1);
    expect(result.scheduleAllocations[0].allocatedInterest.toString()).toBe('1000');
    expect(result.scheduleAllocations[0].allocatedPrincipal.toString()).toBe('8000');
    expect(result.scheduleAllocations[0].newStatus).toBe(ScheduleStatus.PAID);

    expect(result.scheduleAllocations[1].installmentNumber).toBe(2);
    expect(result.scheduleAllocations[1].allocatedInterest.toString()).toBe('900');
    expect(result.scheduleAllocations[1].allocatedPrincipal.toString()).toBe('100');
    expect(result.scheduleAllocations[1].newRemainingAmount.toString()).toBe('8000');
    expect(result.scheduleAllocations[1].newStatus).toBe(ScheduleStatus.PARTIALLY_PAID);
  });

  // TEST 6 — Overpayment handling
  it('TEST 6: Overpayment isolates excess money into unallocatedAmount without inventing future interest', () => {
    const schedules: InputSchedule[] = [
      {
        _id: new Types.ObjectId(),
        installmentNumber: 1,
        dueDate: new Date('2026-04-01'),
        scheduledPrincipal: 9000,
        scheduledInterest: 1000,
        scheduledAmount: 10000,
        paidPrincipal: 0,
        paidInterest: 0,
        paidAmount: 0,
        remainingAmount: 10000,
        status: ScheduleStatus.PENDING
      }
    ];

    const result = PaymentAllocationService.allocatePayment(12000, schedules);

    expect(result.allocatedInterest.toString()).toBe('1000');
    expect(result.allocatedPrincipal.toString()).toBe('9000');
    expect(result.unallocatedAmount.toString()).toBe('2000');
    expect(result.allSchedulesSatisfied).toBe(true);
    expect(result.scheduleAllocations[0].newStatus).toBe(ScheduleStatus.PAID);
    expect(
      result.allocatedInterest
        .plus(result.allocatedPrincipal)
        .plus(result.unallocatedAmount)
        .toString()
    ).toBe('12000');
  });

  it('should reject payment amounts <= 0', () => {
    const schedules: InputSchedule[] = [];
    expect(() => PaymentAllocationService.allocatePayment(0, schedules)).toThrow(
      'Payment amount must be greater than zero'
    );
    expect(() => PaymentAllocationService.allocatePayment(-500, schedules)).toThrow(
      'Payment amount must be greater than zero'
    );
  });
});
