import mongoose, { Types } from 'mongoose';
import crypto from 'crypto';
import Decimal from 'decimal.js';
import { PaymentModel } from './payment.model.js';
import { PaymentScheduleAllocationModel } from './payment-schedule-allocation.model.js';
import { IdempotencyKeyModel } from './idempotency.model.js';
import { getNextPaymentNumber } from './payment-counter.model.js';
import { PaymentAllocationService } from './payment-allocation.service.js';
import { LoanModel } from '../loans/loan.model.js';
import { RepaymentScheduleModel } from '../loans/repayment-schedule.model.js';
import { PersonModel } from '../persons/person.model.js';
import { AuditLogModel } from '../audit/audit-log.model.js';
import { AuditAction, AuditScope } from '../audit/audit-log.types.js';
import { PaymentStatus } from './payment.types.js';
import { LoanStatus } from '../loans/loan.types.js';
import { ScheduleStatus } from '../loans/repayment-schedule.types.js';
import { toDecimal, toDecimal128 } from '../../common/utils/money.js';
import {
  formatPaymentDTO,
  formatPaymentDetailDTO,
  formatPaymentScheduleAllocationDTO,
  PaymentDTO,
  PaymentDetailDTO,
  LoanPaymentHistoryDTO
} from '../../common/utils/dto.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError
} from '../../common/errors/app-error.js';
import {
  CreatePaymentInput,
  PreviewPaymentInput,
  ReversePaymentInput,
  ListPaymentsQueryInput
} from './payment.validation.js';

function isTransactionUnsupportedError(err: any): boolean {
  return (
    err?.code === 20 ||
    err?.codeName === 'IllegalOperation' ||
    Boolean(
      err?.message &&
        (err.message.includes('Transaction numbers are only allowed') ||
          err.message.includes('replica set member'))
    )
  );
}

class LoanAsyncLock {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      try {
        await this.locks.get(key);
      } catch {
        // ignore
      }
    }
    let release: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, promise);
    return () => {
      this.locks.delete(key);
      release!();
    };
  }
}

const loanLock = new LoanAsyncLock();

async function runTransactionally<T>(
  fn: (session?: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch {
    session = undefined;
  }

  if (session) {
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (err: any) {
      try {
        await session.abortTransaction();
      } catch {
        // ignore
      }
      if (isTransactionUnsupportedError(err)) {
        return await fn(undefined);
      }
      throw err;
    } finally {
      try {
        await session.endSession();
      } catch {
        // ignore
      }
    }
  } else {
    return await fn(undefined);
  }
}

export class PaymentService {
  /**
   * Non-mutating payment allocation preview
   */
  static async previewPaymentAllocation(
    tenantId: string | Types.ObjectId,
    input: PreviewPaymentInput
  ) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const loan = await LoanModel.findOne({ _id: input.loanId, tenantId: tenantObjectId });

    if (!loan) {
      throw new NotFoundError('Loan record not found in this tenant');
    }

    if (loan.status === LoanStatus.DRAFT) {
      throw new BadRequestError('Cannot preview payment for a DRAFT loan. Activate the loan first.');
    }
    if (loan.status === LoanStatus.CANCELLED) {
      throw new BadRequestError('Cannot preview payment for a CANCELLED loan.');
    }
    if (loan.status === LoanStatus.CLOSED) {
      throw new BadRequestError('Cannot preview payment for a CLOSED loan.');
    }

    const schedules = await RepaymentScheduleModel.find({
      tenantId: tenantObjectId,
      loanId: loan._id
    }).sort({ installmentNumber: 1 });

    const allocationResult = PaymentAllocationService.allocatePayment(input.amount, schedules);

    return {
      loanId: loan._id!.toString(),
      loanNumber: loan.loanNumber,
      paymentAmount: allocationResult.paymentAmount.toFixed(2),
      allocatedInterest: allocationResult.allocatedInterest.toFixed(2),
      allocatedPrincipal: allocationResult.allocatedPrincipal.toFixed(2),
      unallocatedAmount: allocationResult.unallocatedAmount.toFixed(2),
      allSchedulesSatisfied: allocationResult.allSchedulesSatisfied,
      scheduleAllocations: allocationResult.scheduleAllocations.map((item) => ({
        scheduleId: item.scheduleId.toString(),
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        scheduledAmount: item.scheduledAmount.toFixed(2),
        scheduledPrincipal: item.scheduledPrincipal.toFixed(2),
        scheduledInterest: item.scheduledInterest.toFixed(2),
        allocatedPrincipal: item.allocatedPrincipal.toFixed(2),
        allocatedInterest: item.allocatedInterest.toFixed(2),
        allocatedTotal: item.allocatedTotal.toFixed(2),
        remainingAfterPayment: item.newRemainingAmount.toFixed(2),
        statusAfterPayment: item.newStatus
      }))
    };
  }

  /**
   * Transactional Payment Recording & Ledger Allocation
   */
  static async createPayment(
    tenantId: string | Types.ObjectId,
    input: CreatePaymentInput,
    userId: string,
    idempotencyKey?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ payment: PaymentDTO; isDuplicate?: boolean }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const userObjectId = new Types.ObjectId(userId);

    // 1. Check Idempotency Key
    let requestHash = '';
    if (idempotencyKey) {
      requestHash = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            tenantId: tenantObjectId.toString(),
            loanId: input.loanId,
            amount: input.amount,
            paymentDate: input.paymentDate,
            paymentMethod: input.paymentMethod,
            referenceNumber: input.referenceNumber,
            notes: input.notes
          })
        )
        .digest('hex');

      const existingKey = await IdempotencyKeyModel.findOne({
        tenantId: tenantObjectId,
        key: idempotencyKey
      });

      if (existingKey) {
        if (existingKey.requestHash === requestHash) {
          return {
            payment: existingKey.responseBody,
            isDuplicate: true
          };
        } else {
          throw new ConflictError(
            `Idempotency key '${idempotencyKey}' was already used with a different request payload.`
          );
        }
      }
    }

    // 2. Validate Loan Ownership and Status
    const loan = await LoanModel.findOne({
      _id: input.loanId,
      tenantId: tenantObjectId
    });

    if (!loan) {
      throw new NotFoundError('Loan record not found in this tenant');
    }

    if (loan.status === LoanStatus.DRAFT) {
      throw new BadRequestError('Cannot post payment to a DRAFT loan. Activate the loan first.');
    }
    if (loan.status === LoanStatus.CANCELLED) {
      throw new BadRequestError('Cannot post payment to a CANCELLED loan.');
    }
    if (loan.status === LoanStatus.CLOSED) {
      throw new BadRequestError('Cannot post payment to a CLOSED loan.');
    }

    const borrowerPersonId = loan.borrowerPersonId;

    const unlock = await loanLock.acquire(input.loanId);
    try {
      return await runTransactionally(async (session) => {
        const currentLoan = session
          ? await LoanModel.findOne({ _id: loan._id, tenantId: tenantObjectId }).session(session)
          : await LoanModel.findOne({ _id: loan._id, tenantId: tenantObjectId });

        if (!currentLoan) {
          throw new NotFoundError('Loan record not found in this tenant during transaction');
        }

        if (currentLoan.status === LoanStatus.CLOSED) {
          throw new BadRequestError('Loan has already been closed by a concurrent transaction');
        }

        const schedules = session
          ? await RepaymentScheduleModel.find({
              tenantId: tenantObjectId,
              loanId: currentLoan._id
            })
              .session(session)
              .sort({ installmentNumber: 1 })
          : await RepaymentScheduleModel.find({
              tenantId: tenantObjectId,
              loanId: currentLoan._id
            }).sort({ installmentNumber: 1 });

        const allocationResult = PaymentAllocationService.allocatePayment(input.amount, schedules);
        const paymentNumber = await getNextPaymentNumber(tenantObjectId, session);

        const paymentData = {
          tenantId: tenantObjectId,
          paymentNumber,
          loanId: currentLoan._id,
          borrowerPersonId,
          amount: toDecimal128(allocationResult.paymentAmount),
          paymentDate: new Date(input.paymentDate),
          paymentMethod: input.paymentMethod,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          status: PaymentStatus.POSTED,
          allocatedInterest: toDecimal128(allocationResult.allocatedInterest),
          allocatedPrincipal: toDecimal128(allocationResult.allocatedPrincipal),
          unallocatedAmount: toDecimal128(allocationResult.unallocatedAmount),
          createdBy: userObjectId
        };

        let createdPayment: any;
        if (session) {
          const [p] = await PaymentModel.create([paymentData], { session });
          createdPayment = p;
        } else {
          createdPayment = await PaymentModel.create(paymentData);
        }

        for (const item of allocationResult.scheduleAllocations) {
          const scheduleDoc = schedules.find((s) => s._id.toString() === item.scheduleId.toString());
          if (!scheduleDoc) continue;

          if (item.allocatedTotal.gt(0)) {
            const allocationDoc = {
              tenantId: tenantObjectId,
              paymentId: createdPayment._id,
              loanId: currentLoan._id,
              scheduleId: scheduleDoc._id,
              installmentNumber: item.installmentNumber,
              interestAmount: toDecimal128(item.allocatedInterest),
              principalAmount: toDecimal128(item.allocatedPrincipal),
              totalAmount: toDecimal128(item.allocatedTotal)
            };

            if (session) {
              await PaymentScheduleAllocationModel.create([allocationDoc], { session });
            } else {
              await PaymentScheduleAllocationModel.create(allocationDoc);
            }
          }

          scheduleDoc.paidPrincipal = toDecimal128(item.newPaidPrincipal);
          scheduleDoc.paidInterest = toDecimal128(item.newPaidInterest);
          scheduleDoc.paidAmount = toDecimal128(item.newPaidAmount);
          scheduleDoc.remainingAmount = toDecimal128(item.newRemainingAmount);
          scheduleDoc.status = item.newStatus;
          if (item.newStatus === ScheduleStatus.PAID) {
            scheduleDoc.paidAt = new Date(input.paymentDate);
          }

          if (session) {
            await scheduleDoc.save({ session });
          } else {
            await scheduleDoc.save();
          }
        }

        let cumPaidPrincipal = new Decimal(0);
        let cumPaidInterest = new Decimal(0);

        for (const s of schedules) {
          cumPaidPrincipal = cumPaidPrincipal.plus(toDecimal(s.paidPrincipal));
          cumPaidInterest = cumPaidInterest.plus(toDecimal(s.paidInterest));
        }

        const loanPrincipal = toDecimal(currentLoan.principalAmount);
        const loanTotalInterest = toDecimal(currentLoan.totalInterest);

        const newOutstandingPrincipal = Decimal.max(0, loanPrincipal.minus(cumPaidPrincipal));
        const newOutstandingInterest = Decimal.max(0, loanTotalInterest.minus(cumPaidInterest));
        const newOutstandingTotal = newOutstandingPrincipal.plus(newOutstandingInterest);
        const newTotalPaid = cumPaidPrincipal.plus(cumPaidInterest);

        currentLoan.totalPaid = toDecimal128(newTotalPaid);
        currentLoan.outstandingPrincipal = toDecimal128(newOutstandingPrincipal);
        currentLoan.outstandingInterest = toDecimal128(newOutstandingInterest);
        currentLoan.updatedBy = userObjectId;

        if (newOutstandingTotal.lte(0.0001)) {
          currentLoan.status = LoanStatus.CLOSED;
        } else {
          currentLoan.status = LoanStatus.PARTIALLY_PAID;
        }

        if (session) {
          await currentLoan.save({ session });
        } else {
          await currentLoan.save();
        }

        const auditEntry = {
          scope: AuditScope.TENANT,
          tenantId: tenantObjectId,
          userId: userObjectId,
          action: AuditAction.CREATE,
          entity: 'Payment',
          entityId: createdPayment._id.toString(),
          changes: {
            paymentNumber: createdPayment.paymentNumber,
            loanId: currentLoan._id.toString(),
            loanNumber: currentLoan.loanNumber,
            amount: allocationResult.paymentAmount.toFixed(2),
            allocatedInterest: allocationResult.allocatedInterest.toFixed(2),
            allocatedPrincipal: allocationResult.allocatedPrincipal.toFixed(2),
            unallocatedAmount: allocationResult.unallocatedAmount.toFixed(2),
            paymentMethod: input.paymentMethod,
            status: PaymentStatus.POSTED
          },
          ipAddress,
          userAgent
        };

        if (session) {
          await AuditLogModel.create([auditEntry], { session });
        } else {
          await AuditLogModel.create(auditEntry);
        }

        const formattedDTO = formatPaymentDTO(
          createdPayment,
          currentLoan.loanNumber
        );

        if (idempotencyKey) {
          const idempData = {
            tenantId: tenantObjectId,
            key: idempotencyKey,
            requestHash,
            responseStatus: 201,
            responseBody: formattedDTO,
            paymentId: createdPayment._id
          };

          if (session) {
            await IdempotencyKeyModel.create([idempData], { session });
          } else {
            await IdempotencyKeyModel.create(idempData);
          }
        }

        return { payment: formattedDTO };
      });
    } finally {
      unlock();
    }
  }

  /**
   * Transactional Payment Reversal
   */
  static async reversePayment(
    tenantId: string | Types.ObjectId,
    paymentId: string | Types.ObjectId,
    input: ReversePaymentInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<PaymentDetailDTO> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const paymentObjectId = new Types.ObjectId(paymentId);
    const userObjectId = new Types.ObjectId(userId);

    const payment = await PaymentModel.findOne({
      _id: paymentObjectId,
      tenantId: tenantObjectId
    });

    if (!payment) {
      throw new NotFoundError('Payment record not found in this tenant');
    }

    if (payment.status === PaymentStatus.REVERSED) {
      throw new BadRequestError('Payment is already reversed and cannot be reversed again');
    }

    const unlock = await loanLock.acquire(payment.loanId.toString());
    try {
      return await runTransactionally(async (session) => {
        const loan = session
          ? await LoanModel.findOne({ _id: payment.loanId, tenantId: tenantObjectId }).session(session)
          : await LoanModel.findOne({ _id: payment.loanId, tenantId: tenantObjectId });

        if (!loan) {
          throw new NotFoundError('Associated loan not found in this tenant');
        }

        const schedules = session
          ? await RepaymentScheduleModel.find({
              tenantId: tenantObjectId,
              loanId: loan._id
            })
              .session(session)
              .sort({ installmentNumber: 1 })
          : await RepaymentScheduleModel.find({
              tenantId: tenantObjectId,
              loanId: loan._id
            }).sort({ installmentNumber: 1 });

        const paymentAllocations = session
          ? await PaymentScheduleAllocationModel.find({
              tenantId: tenantObjectId,
              paymentId: payment._id
            }).session(session)
          : await PaymentScheduleAllocationModel.find({
              tenantId: tenantObjectId,
              paymentId: payment._id
            });

        for (const alloc of paymentAllocations) {
          const scheduleDoc = schedules.find(
            (s) => s._id.toString() === alloc.scheduleId.toString()
          );
          if (!scheduleDoc) continue;

          const allocInterest = toDecimal(alloc.interestAmount);
          const allocPrincipal = toDecimal(alloc.principalAmount);
          const allocTotal = toDecimal(alloc.totalAmount);

          const currentPaidPrincipal = toDecimal(scheduleDoc.paidPrincipal);
          const currentPaidInterest = toDecimal(scheduleDoc.paidInterest);
          const currentPaidAmount = toDecimal(scheduleDoc.paidAmount);
          const scheduledAmount = toDecimal(scheduleDoc.scheduledAmount);

          const newPaidPrincipal = Decimal.max(0, currentPaidPrincipal.minus(allocPrincipal));
          const newPaidInterest = Decimal.max(0, currentPaidInterest.minus(allocInterest));
          const newPaidAmount = Decimal.max(0, currentPaidAmount.minus(allocTotal));
          const newRemaining = Decimal.max(0, scheduledAmount.minus(newPaidAmount));

          scheduleDoc.paidPrincipal = toDecimal128(newPaidPrincipal);
          scheduleDoc.paidInterest = toDecimal128(newPaidInterest);
          scheduleDoc.paidAmount = toDecimal128(newPaidAmount);
          scheduleDoc.remainingAmount = toDecimal128(newRemaining);

          if (newRemaining.lte(0.0001)) {
            scheduleDoc.status = ScheduleStatus.PAID;
          } else if (newPaidAmount.gt(0)) {
            scheduleDoc.status = ScheduleStatus.PARTIALLY_PAID;
            scheduleDoc.paidAt = undefined;
          } else {
            scheduleDoc.status = ScheduleStatus.PENDING;
            scheduleDoc.paidAt = undefined;
          }

          if (session) {
            await scheduleDoc.save({ session });
          } else {
            await scheduleDoc.save();
          }
        }

      let cumPaidPrincipal = new Decimal(0);
      let cumPaidInterest = new Decimal(0);

      for (const s of schedules) {
        cumPaidPrincipal = cumPaidPrincipal.plus(toDecimal(s.paidPrincipal));
        cumPaidInterest = cumPaidInterest.plus(toDecimal(s.paidInterest));
      }

      const loanPrincipal = toDecimal(loan.principalAmount);
      const loanTotalInterest = toDecimal(loan.totalInterest);

      const newOutstandingPrincipal = Decimal.max(0, loanPrincipal.minus(cumPaidPrincipal));
      const newOutstandingInterest = Decimal.max(0, loanTotalInterest.minus(cumPaidInterest));
      const newOutstandingTotal = newOutstandingPrincipal.plus(newOutstandingInterest);
      const newTotalPaid = cumPaidPrincipal.plus(cumPaidInterest);

      loan.totalPaid = toDecimal128(newTotalPaid);
      loan.outstandingPrincipal = toDecimal128(newOutstandingPrincipal);
      loan.outstandingInterest = toDecimal128(newOutstandingInterest);
      loan.updatedBy = userObjectId;

      if (newOutstandingTotal.lte(0.0001)) {
        loan.status = LoanStatus.CLOSED;
      } else {
        loan.status = newTotalPaid.gt(0) ? LoanStatus.PARTIALLY_PAID : LoanStatus.ACTIVE;
      }

      if (session) {
        await loan.save({ session });
      } else {
        await loan.save();
      }

      payment.status = PaymentStatus.REVERSED;
      payment.reversedBy = userObjectId;
      payment.reversedAt = new Date();
      payment.reversalReason = input.reason;

      if (session) {
        await payment.save({ session });
      } else {
        await payment.save();
      }

      const auditEntry = {
        scope: AuditScope.TENANT,
        tenantId: tenantObjectId,
        userId: userObjectId,
        action: AuditAction.STATUS_CHANGE,
        entity: 'Payment',
        entityId: payment._id!.toString(),
        changes: {
          paymentNumber: payment.paymentNumber,
          previousStatus: PaymentStatus.POSTED,
          newStatus: PaymentStatus.REVERSED,
          reversalReason: input.reason,
          restoredLoanOutstanding: newOutstandingTotal.toFixed(2)
        },
        ipAddress,
        userAgent
      };

      if (session) {
        await AuditLogModel.create([auditEntry], { session });
      } else {
        await AuditLogModel.create(auditEntry);
      }

      return this.getPaymentById(tenantId, payment._id!);
    });
    } finally {
      unlock();
    }
  }

  /**
   * Paginated list of payments with filtering
   */
  static async listPayments(
    tenantId: string | Types.ObjectId,
    query: ListPaymentsQueryInput
  ): Promise<{ payments: PaymentDTO[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const filter: Record<string, any> = { tenantId: tenantObjectId };

    if (query.loanId) {
      filter.loanId = new Types.ObjectId(query.loanId);
    }
    if (query.borrowerPersonId) {
      filter.borrowerPersonId = new Types.ObjectId(query.borrowerPersonId);
    }
    if (query.paymentMethod) {
      filter.paymentMethod = query.paymentMethod;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.referenceNumber) {
      filter.referenceNumber = { $regex: query.referenceNumber, $options: 'i' };
    }
    if (query.dateFrom || query.dateTo) {
      filter.paymentDate = {};
      if (query.dateFrom) {
        filter.paymentDate.$gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        filter.paymentDate.$lte = new Date(query.dateTo);
      }
    }

    const total = await PaymentModel.countDocuments(filter);
    const skip = (query.page - 1) * query.limit;
    const sortField = query.sortBy || 'paymentDate';
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;

    const payments = await PaymentModel.find(filter)
      .populate('loanId', 'loanNumber')
      .populate('borrowerPersonId', 'displayName')
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(query.limit);

    const formattedPayments = payments.map((p: any) =>
      formatPaymentDTO(
        p,
        p.loanId?.loanNumber,
        p.borrowerPersonId?.displayName
      )
    );

    return {
      payments: formattedPayments,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1
      }
    };
  }

  /**
   * Detail of a single payment with loan, borrower, and schedule allocations
   */
  static async getPaymentById(
    tenantId: string | Types.ObjectId,
    paymentId: string | Types.ObjectId
  ): Promise<PaymentDetailDTO> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const paymentObjectId = new Types.ObjectId(paymentId);

    const payment = await PaymentModel.findOne({
      _id: paymentObjectId,
      tenantId: tenantObjectId
    })
      .populate('createdBy', 'email role')
      .populate('reversedBy', 'email role');

    if (!payment) {
      throw new NotFoundError('Payment record not found in this tenant');
    }

    const loan = await LoanModel.findOne({
      _id: payment.loanId,
      tenantId: tenantObjectId
    });

    if (!loan) {
      throw new NotFoundError('Associated loan record not found');
    }

    const [lender, borrower] = await Promise.all([
      PersonModel.findOne({ _id: loan.lenderPersonId, tenantId: tenantObjectId }),
      PersonModel.findOne({ _id: loan.borrowerPersonId, tenantId: tenantObjectId })
    ]);

    const scheduleAllocations = await PaymentScheduleAllocationModel.find({
      tenantId: tenantObjectId,
      paymentId: payment._id
    }).sort({ installmentNumber: 1 });

    const schedules = await RepaymentScheduleModel.find({
      tenantId: tenantObjectId,
      loanId: loan._id
    });

    const populatedAllocations = scheduleAllocations.map((sa) => {
      const sch = schedules.find((s) => s._id.toString() === sa.scheduleId.toString());
      return formatPaymentScheduleAllocationDTO(sa, sch?.dueDate);
    });

    return formatPaymentDetailDTO(
      payment,
      loan,
      lender,
      borrower,
      populatedAllocations
    );
  }

  /**
   * Loan Payment Ledger History and Aggregates
   */
  static async getLoanPaymentHistory(
    tenantId: string | Types.ObjectId,
    loanId: string | Types.ObjectId
  ): Promise<LoanPaymentHistoryDTO> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const loanObjectId = new Types.ObjectId(loanId);

    const loan = await LoanModel.findOne({
      _id: loanObjectId,
      tenantId: tenantObjectId
    });

    if (!loan) {
      throw new NotFoundError('Loan record not found in this tenant');
    }

    const payments = await PaymentModel.find({
      tenantId: tenantObjectId,
      loanId: loanObjectId
    })
      .populate('borrowerPersonId', 'displayName')
      .sort({ paymentDate: -1, createdAt: -1 });

    const postedPayments = payments.filter((p) => p.status === PaymentStatus.POSTED);

    let totalInterestPaid = new Decimal(0);
    let totalPrincipalPaid = new Decimal(0);

    for (const p of postedPayments) {
      totalInterestPaid = totalInterestPaid.plus(toDecimal(p.allocatedInterest));
      totalPrincipalPaid = totalPrincipalPaid.plus(toDecimal(p.allocatedPrincipal));
    }

    const totalPaid = totalInterestPaid.plus(totalPrincipalPaid);
    const outstandingPrincipal = toDecimal(loan.outstandingPrincipal);
    const outstandingInterest = toDecimal(loan.outstandingInterest);
    const outstandingTotal = outstandingPrincipal.plus(outstandingInterest);

    return {
      payments: payments.map((p: any) =>
        formatPaymentDTO(p, loan.loanNumber, p.borrowerPersonId?.displayName)
      ),
      totalPayments: payments.length,
      totalPaid: totalPaid.toFixed(2),
      totalInterestPaid: totalInterestPaid.toFixed(2),
      totalPrincipalPaid: totalPrincipalPaid.toFixed(2),
      outstandingPrincipal: outstandingPrincipal.toFixed(2),
      outstandingInterest: outstandingInterest.toFixed(2),
      outstandingTotal: outstandingTotal.toFixed(2)
    };
  }
}
