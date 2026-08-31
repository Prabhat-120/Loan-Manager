import mongoose, { Types } from 'mongoose';
import { LoanModel } from './loan.model.js';
import { RepaymentScheduleModel } from './repayment-schedule.model.js';
import { PersonModel } from '../persons/person.model.js';
import { PersonStatus } from '../persons/person.types.js';
import { AuditLogModel } from '../audit/audit-log.model.js';
import { AuditAction, AuditScope } from '../audit/audit-log.types.js';
import { SubscriptionLimitService } from '../tenants/subscription.service.js';
import { getNextLoanNumber } from './loan-counter.model.js';
import {
  LoanStatus,
  PaymentFrequency,
  InterestRateType
} from './loan.types.js';
import { ScheduleStatus } from './repayment-schedule.types.js';
import {
  calculateLoanTotals,
  CalculationInput
} from './calculations/calculations.js';
import { toDecimal128 } from '../../common/utils/money.js';
import {
  formatLoanDTO,
  formatLoanDetailDTO,
  formatRepaymentScheduleDTO
} from '../../common/utils/dto.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError
} from '../../common/errors/app-error.js';
import {
  CreateLoanInput,
  UpdateDraftLoanInput,
  ListLoansQueryInput
} from './loan.validation.js';

export class LoanService {
  /**
   * Transactional Loan & Repayment Schedule Creation
   */
  static async createLoan(
    tenantId: string | Types.ObjectId,
    input: CreateLoanInput,
    userId: string,
    initialStatus: LoanStatus = LoanStatus.DRAFT
  ) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const userObjectId = new Types.ObjectId(userId);

    // 1. Verify Lender and Borrower exist in same tenant and are ACTIVE
    const [lender, borrower] = await Promise.all([
      PersonModel.findOne({ _id: input.lenderPersonId, tenantId: tenantObjectId }),
      PersonModel.findOne({ _id: input.borrowerPersonId, tenantId: tenantObjectId })
    ]);

    if (!lender) {
      throw new NotFoundError('Lender person record not found in this tenant');
    }
    if (!borrower) {
      throw new NotFoundError('Borrower person record not found in this tenant');
    }

    if (lender.status !== PersonStatus.ACTIVE) {
      throw new BadRequestError(`Lender is inactive (status: ${lender.status}). Only ACTIVE persons can participate in loans.`);
    }
    if (borrower.status !== PersonStatus.ACTIVE) {
      throw new BadRequestError(`Borrower is inactive (status: ${borrower.status}). Only ACTIVE persons can participate in loans.`);
    }

    if (lender._id!.toString() === borrower._id!.toString()) {
      throw new BadRequestError('Lender and Borrower cannot be the same Person');
    }

    // 2. If creating directly as ACTIVE, check subscription loan limit
    if (initialStatus === LoanStatus.ACTIVE) {
      const limitCheck = await SubscriptionLimitService.checkLoanLimit(tenantId);
      if (!limitCheck.allowed) {
        throw new ForbiddenError(
          `Tenant has reached the active loan limit (${limitCheck.max}). Upgrade subscription plan to create more active loans.`
        );
      }
    }

    // 3. Compute Schedule and Financial Totals using pure calculation engine
    const calcInput: CalculationInput = {
      loanType: input.loanType,
      principalAmount: input.principalAmount,
      annualInterestRate: input.interestRate,
      interestCalculationMethod: input.interestCalculationMethod,
      termMonths: input.termMonths,
      startDate: new Date(input.startDate),
      firstDueDate: new Date(input.firstDueDate),
      paymentFrequency: input.paymentFrequency || PaymentFrequency.MONTHLY
    };

    const calculationResult = calculateLoanTotals(calcInput);
    const maturityDate =
      calculationResult.schedule.length > 0
        ? calculationResult.schedule[calculationResult.schedule.length - 1].dueDate
        : new Date(input.firstDueDate);

    // 4. Execute creation with transaction support
    let session: mongoose.ClientSession | undefined;
    let useTransaction = true;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      useTransaction = false;
      session = undefined;
    }

    let createdLoanId: Types.ObjectId | undefined;

    try {
      // Generate safe unique loan number
      let loanNumber: string;
      if (useTransaction && session) {
        try {
          loanNumber = await getNextLoanNumber(tenantObjectId, session);
        } catch (err: any) {
          if (
            err?.message?.includes('Transaction numbers are only allowed') ||
            err?.codeName === 'IllegalOperation'
          ) {
            useTransaction = false;
            await session.endSession();
            session = undefined;
            loanNumber = await getNextLoanNumber(tenantObjectId);
          } else {
            throw err;
          }
        }
      } else {
        loanNumber = await getNextLoanNumber(tenantObjectId);
      }

      // Create Loan
      let loan;
      if (useTransaction && session) {
        const [l] = await LoanModel.create(
          [
            {
              tenantId: tenantObjectId,
              loanNumber,
              lenderPersonId: lender._id,
              borrowerPersonId: borrower._id,
              loanType: input.loanType,
              principalAmount: toDecimal128(calculationResult.principalAmount),
              interestRate: toDecimal128(input.interestRate),
              interestRateType: input.interestRateType || InterestRateType.PERCENTAGE_PER_YEAR,
              interestCalculationMethod: input.interestCalculationMethod,
              termMonths: input.termMonths,
              startDate: new Date(input.startDate),
              firstDueDate: new Date(input.firstDueDate),
              maturityDate,
              paymentFrequency: input.paymentFrequency || PaymentFrequency.MONTHLY,
              status: initialStatus,
              totalInterest: toDecimal128(calculationResult.totalInterest),
              totalPayable: toDecimal128(calculationResult.totalPayable),
              totalPaid: toDecimal128(0),
              outstandingPrincipal: toDecimal128(calculationResult.principalAmount),
              outstandingInterest: toDecimal128(calculationResult.totalInterest),
              notes: input.notes,
              createdBy: userObjectId
            }
          ],
          { session }
        );
        loan = l;
      } else {
        loan = await LoanModel.create({
          tenantId: tenantObjectId,
          loanNumber,
          lenderPersonId: lender._id,
          borrowerPersonId: borrower._id,
          loanType: input.loanType,
          principalAmount: toDecimal128(calculationResult.principalAmount),
          interestRate: toDecimal128(input.interestRate),
          interestRateType: input.interestRateType || InterestRateType.PERCENTAGE_PER_YEAR,
          interestCalculationMethod: input.interestCalculationMethod,
          termMonths: input.termMonths,
          startDate: new Date(input.startDate),
          firstDueDate: new Date(input.firstDueDate),
          maturityDate,
          paymentFrequency: input.paymentFrequency || PaymentFrequency.MONTHLY,
          status: initialStatus,
          totalInterest: toDecimal128(calculationResult.totalInterest),
          totalPayable: toDecimal128(calculationResult.totalPayable),
          totalPaid: toDecimal128(0),
          outstandingPrincipal: toDecimal128(calculationResult.principalAmount),
          outstandingInterest: toDecimal128(calculationResult.totalInterest),
          notes: input.notes,
          createdBy: userObjectId
        });
      }

      createdLoanId = loan._id;

      // Create Repayment Schedule items
      const scheduleDocs = calculationResult.schedule.map((item) => ({
        tenantId: tenantObjectId,
        loanId: loan._id,
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        openingPrincipal: toDecimal128(item.openingPrincipal),
        scheduledPrincipal: toDecimal128(item.scheduledPrincipal),
        scheduledInterest: toDecimal128(item.scheduledInterest),
        scheduledAmount: toDecimal128(item.scheduledAmount),
        paidPrincipal: toDecimal128(0),
        paidInterest: toDecimal128(0),
        paidAmount: toDecimal128(0),
        remainingAmount: toDecimal128(item.scheduledAmount),
        status: ScheduleStatus.PENDING
      }));

      if (useTransaction && session) {
        await RepaymentScheduleModel.insertMany(scheduleDocs, { session });
      } else {
        await RepaymentScheduleModel.insertMany(scheduleDocs);
      }

      // Create Audit Log
      if (useTransaction && session) {
        await AuditLogModel.create(
          [
            {
              scope: AuditScope.TENANT,
              tenantId: tenantObjectId,
              userId: userObjectId,
              action: AuditAction.CREATE,
              entity: 'Loan',
              entityId: loan._id.toString(),
              changes: {
                loanNumber: loan.loanNumber,
                loanType: loan.loanType,
                principalAmount: calculationResult.principalAmount,
                status: loan.status
              }
            }
          ],
          { session }
        );
      } else {
        await AuditLogModel.create({
          scope: AuditScope.TENANT,
          tenantId: tenantObjectId,
          userId: userObjectId,
          action: AuditAction.CREATE,
          entity: 'Loan',
          entityId: loan._id.toString(),
          changes: {
            loanNumber: loan.loanNumber,
            loanType: loan.loanType,
            principalAmount: calculationResult.principalAmount,
            status: loan.status
          }
        });
      }

      if (useTransaction && session) {
        await session.commitTransaction();
      }

      return formatLoanDetailDTO(loan, lender, borrower, {
        total: scheduleDocs.length,
        pending: scheduleDocs.length,
        paid: 0,
        overdue: 0
      });
    } catch (error) {
      if (useTransaction && session) {
        await session.abortTransaction();
      } else if (createdLoanId) {
        // Manual compensation / rollback for standalone mode
        await RepaymentScheduleModel.deleteMany({ loanId: createdLoanId });
        await LoanModel.findByIdAndDelete(createdLoanId);
        await AuditLogModel.deleteMany({ entity: 'Loan', entityId: createdLoanId.toString() });
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * List Loans with Tenant Isolation, Multi-field Search, Filters, and Pagination
   */
  static async listLoans(tenantId: string | Types.ObjectId, query: ListLoansQueryInput) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const filter: Record<string, any> = { tenantId: tenantObjectId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.loanType) {
      filter.loanType = query.loanType;
    }

    if (query.loanNumber) {
      filter.loanNumber = { $regex: query.loanNumber, $options: 'i' };
    }

    if (query.lenderPersonId) {
      filter.lenderPersonId = new Types.ObjectId(query.lenderPersonId);
    }

    if (query.borrowerPersonId) {
      filter.borrowerPersonId = new Types.ObjectId(query.borrowerPersonId);
    }

    if (query.dateFrom || query.dateTo) {
      filter.startDate = {};
      if (query.dateFrom) filter.startDate.$gte = query.dateFrom;
      if (query.dateTo) filter.startDate.$lte = query.dateTo;
    }

    // Search across loanNumber, or Person names
    if (query.search) {
      const searchRegex = { $regex: query.search, $options: 'i' };
      const matchingPeople = await PersonModel.find(
        { tenantId: tenantObjectId, displayName: searchRegex },
        { _id: 1 }
      ).lean();
      const personIds = matchingPeople.map((p) => p._id);

      filter.$or = [
        { loanNumber: searchRegex },
        { lenderPersonId: { $in: personIds } },
        { borrowerPersonId: { $in: personIds } }
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;

    const [loans, total] = await Promise.all([
      LoanModel.find(filter)
        .populate('lenderPersonId')
        .populate('borrowerPersonId')
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanModel.countDocuments(filter)
    ]);

    return {
      loans: loans.map((l: any) => formatLoanDTO(l, l.lenderPersonId, l.borrowerPersonId)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get Loan Detail with populated Lender, Borrower, and Schedule Statistics
   */
  static async getLoanById(tenantId: string | Types.ObjectId, loanId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const loan = await LoanModel.findOne({ _id: loanId, tenantId: tenantObjectId })
      .populate('lenderPersonId')
      .populate('borrowerPersonId');

    if (!loan) {
      throw new NotFoundError('Loan not found in this tenant');
    }

    const scheduleItems = await RepaymentScheduleModel.find({
      loanId: loan._id,
      tenantId: tenantObjectId
    }).lean();

    const scheduleStats = {
      total: scheduleItems.length,
      pending: scheduleItems.filter((i) => i.status === ScheduleStatus.PENDING).length,
      paid: scheduleItems.filter((i) => i.status === ScheduleStatus.PAID).length,
      overdue: scheduleItems.filter((i) => i.status === ScheduleStatus.OVERDUE).length
    };

    return formatLoanDetailDTO(loan, loan.lenderPersonId, loan.borrowerPersonId, scheduleStats);
  }

  /**
   * Update DRAFT Loan Terms & Regenerate Schedule Transactionally
   */
  static async updateDraftLoan(
    tenantId: string | Types.ObjectId,
    loanId: string,
    input: UpdateDraftLoanInput,
    userId: string
  ) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const userObjectId = new Types.ObjectId(userId);

    const loan = await LoanModel.findOne({ _id: loanId, tenantId: tenantObjectId });
    if (!loan) {
      throw new NotFoundError('Loan not found in this tenant');
    }

    if (loan.status !== LoanStatus.DRAFT) {
      throw new ForbiddenError(
        `Cannot modify financial terms of loan with status ${loan.status}. Only DRAFT loans can be edited.`
      );
    }

    const lenderPersonId = input.lenderPersonId ? new Types.ObjectId(input.lenderPersonId) : loan.lenderPersonId;
    const borrowerPersonId = input.borrowerPersonId ? new Types.ObjectId(input.borrowerPersonId) : loan.borrowerPersonId;

    if (lenderPersonId.toString() === borrowerPersonId.toString()) {
      throw new BadRequestError('Lender and Borrower cannot be the same Person');
    }

    // Verify persons if changed
    const [lender, borrower] = await Promise.all([
      PersonModel.findOne({ _id: lenderPersonId, tenantId: tenantObjectId }),
      PersonModel.findOne({ _id: borrowerPersonId, tenantId: tenantObjectId })
    ]);

    if (!lender || !borrower) {
      throw new NotFoundError('Lender or borrower person not found in tenant');
    }

    if (lender.status !== PersonStatus.ACTIVE || borrower.status !== PersonStatus.ACTIVE) {
      throw new BadRequestError('Both Lender and Borrower must be ACTIVE');
    }

    const principalAmount = input.principalAmount || loan.principalAmount.toString();
    const interestRate = input.interestRate || loan.interestRate.toString();
    const loanType = input.loanType || loan.loanType;
    const interestCalculationMethod = input.interestCalculationMethod || loan.interestCalculationMethod;
    const termMonths = input.termMonths || loan.termMonths;
    const startDate = input.startDate ? new Date(input.startDate) : loan.startDate;
    const firstDueDate = input.firstDueDate ? new Date(input.firstDueDate) : loan.firstDueDate;
    const paymentFrequency = input.paymentFrequency || loan.paymentFrequency;

    const calcResult = calculateLoanTotals({
      loanType,
      principalAmount,
      annualInterestRate: interestRate,
      interestCalculationMethod,
      termMonths,
      startDate,
      firstDueDate,
      paymentFrequency
    });

    const maturityDate =
      calcResult.schedule.length > 0
        ? calcResult.schedule[calcResult.schedule.length - 1].dueDate
        : firstDueDate;

    let session: mongoose.ClientSession | undefined;
    let useTransaction = true;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      useTransaction = false;
      session = undefined;
    }

    try {
      // Update Loan
      loan.lenderPersonId = lenderPersonId;
      loan.borrowerPersonId = borrowerPersonId;
      loan.loanType = loanType;
      loan.principalAmount = toDecimal128(calcResult.principalAmount);
      loan.interestRate = toDecimal128(interestRate);
      loan.interestCalculationMethod = interestCalculationMethod;
      loan.termMonths = termMonths;
      loan.startDate = startDate;
      loan.firstDueDate = firstDueDate;
      loan.maturityDate = maturityDate;
      loan.paymentFrequency = paymentFrequency;
      loan.totalInterest = toDecimal128(calcResult.totalInterest);
      loan.totalPayable = toDecimal128(calcResult.totalPayable);
      loan.outstandingPrincipal = toDecimal128(calcResult.principalAmount);
      loan.outstandingInterest = toDecimal128(calcResult.totalInterest);
      if (input.notes !== undefined) loan.notes = input.notes;
      loan.updatedBy = userObjectId;

      if (useTransaction && session) {
        try {
          await loan.save({ session });
        } catch (err: any) {
          if (
            err?.message?.includes('Transaction numbers are only allowed') ||
            err?.codeName === 'IllegalOperation'
          ) {
            useTransaction = false;
            await session.endSession();
            session = undefined;
            await loan.save();
          } else {
            throw err;
          }
        }
      } else {
        await loan.save();
      }

      // Delete old schedule & insert regenerated schedule
      if (useTransaction && session) {
        await RepaymentScheduleModel.deleteMany({ loanId: loan._id, tenantId: tenantObjectId }, { session });
      } else {
        await RepaymentScheduleModel.deleteMany({ loanId: loan._id, tenantId: tenantObjectId });
      }

      const scheduleDocs = calcResult.schedule.map((item) => ({
        tenantId: tenantObjectId,
        loanId: loan._id,
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        openingPrincipal: toDecimal128(item.openingPrincipal),
        scheduledPrincipal: toDecimal128(item.scheduledPrincipal),
        scheduledInterest: toDecimal128(item.scheduledInterest),
        scheduledAmount: toDecimal128(item.scheduledAmount),
        paidPrincipal: toDecimal128(0),
        paidInterest: toDecimal128(0),
        paidAmount: toDecimal128(0),
        remainingAmount: toDecimal128(item.scheduledAmount),
        status: ScheduleStatus.PENDING
      }));

      if (useTransaction && session) {
        await RepaymentScheduleModel.insertMany(scheduleDocs, { session });
      } else {
        await RepaymentScheduleModel.insertMany(scheduleDocs);
      }

      // Record Audit Log
      if (useTransaction && session) {
        await AuditLogModel.create(
          [
            {
              scope: AuditScope.TENANT,
              tenantId: tenantObjectId,
              userId: userObjectId,
              action: AuditAction.UPDATE,
              entity: 'Loan',
              entityId: loan._id.toString(),
              changes: {
                principalAmount: calcResult.principalAmount,
                interestRate,
                termMonths
              }
            }
          ],
          { session }
        );
      } else {
        await AuditLogModel.create({
          scope: AuditScope.TENANT,
          tenantId: tenantObjectId,
          userId: userObjectId,
          action: AuditAction.UPDATE,
          entity: 'Loan',
          entityId: loan._id.toString(),
          changes: {
            principalAmount: calcResult.principalAmount,
            interestRate,
            termMonths
          }
        });
      }

      if (useTransaction && session) {
        await session.commitTransaction();
      }

      return formatLoanDetailDTO(loan, lender, borrower, {
        total: scheduleDocs.length,
        pending: scheduleDocs.length,
        paid: 0,
        overdue: 0
      });
    } catch (error) {
      if (useTransaction && session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Activate Loan (DRAFT -> ACTIVE) with subscription check
   */
  static async activateLoan(tenantId: string | Types.ObjectId, loanId: string, userId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const userObjectId = new Types.ObjectId(userId);

    const loan = await LoanModel.findOne({ _id: loanId, tenantId: tenantObjectId });
    if (!loan) {
      throw new NotFoundError('Loan not found in this tenant');
    }

    if (loan.status !== LoanStatus.DRAFT) {
      throw new BadRequestError(`Only DRAFT loans can be activated (current status: ${loan.status})`);
    }

    // Enforce active loan subscription limit
    const limitCheck = await SubscriptionLimitService.checkLoanLimit(tenantId);
    if (!limitCheck.allowed) {
      throw new ForbiddenError(
        `Active loan limit (${limitCheck.max}) reached for current subscription plan. Upgrade plan to activate more loans.`
      );
    }

    loan.status = LoanStatus.ACTIVE;
    loan.updatedBy = userObjectId;
    await loan.save();

    await AuditLogModel.create({
      scope: AuditScope.TENANT,
      tenantId: tenantObjectId,
      userId: userObjectId,
      action: AuditAction.STATUS_CHANGE,
      entity: 'Loan',
      entityId: loan._id.toString(),
      changes: { status: LoanStatus.ACTIVE, previousStatus: LoanStatus.DRAFT }
    });

    return LoanService.getLoanById(tenantId, loanId);
  }

  /**
   * Cancel Loan (DRAFT or ACTIVE with 0 paid -> CANCELLED)
   */
  static async cancelLoan(tenantId: string | Types.ObjectId, loanId: string, userId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const userObjectId = new Types.ObjectId(userId);

    const loan = await LoanModel.findOne({ _id: loanId, tenantId: tenantObjectId });
    if (!loan) {
      throw new NotFoundError('Loan not found in this tenant');
    }

    if (loan.status === LoanStatus.CLOSED || loan.status === LoanStatus.CANCELLED) {
      throw new BadRequestError(`Cannot cancel a loan with status ${loan.status}`);
    }

    const previousStatus = loan.status;
    loan.status = LoanStatus.CANCELLED;
    loan.updatedBy = userObjectId;
    await loan.save();

    await AuditLogModel.create({
      scope: AuditScope.TENANT,
      tenantId: tenantObjectId,
      userId: userObjectId,
      action: AuditAction.STATUS_CHANGE,
      entity: 'Loan',
      entityId: loan._id.toString(),
      changes: { status: LoanStatus.CANCELLED, previousStatus }
    });

    return LoanService.getLoanById(tenantId, loanId);
  }

  /**
   * Get Repayment Schedule Installments for a Loan
   */
  static async getRepaymentSchedule(tenantId: string | Types.ObjectId, loanId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);

    // Verify loan belongs to tenant first (prevents IDOR)
    const loan = await LoanModel.findOne({ _id: loanId, tenantId: tenantObjectId });
    if (!loan) {
      throw new NotFoundError('Loan not found in this tenant');
    }

    const schedule = await RepaymentScheduleModel.find({
      loanId: loan._id,
      tenantId: tenantObjectId
    }).sort({ installmentNumber: 1 });

    return schedule.map(formatRepaymentScheduleDTO);
  }

  /**
   * Get Loans Given by a Person (lenderPersonId === personId)
   */
  static async getLoansGivenByPerson(
    tenantId: string | Types.ObjectId,
    personId: string,
    page = 1,
    limit = 10
  ) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const personObjectId = new Types.ObjectId(personId);

    // Verify person exists in tenant
    const person = await PersonModel.findOne({ _id: personObjectId, tenantId: tenantObjectId });
    if (!person) {
      throw new NotFoundError('Person not found in this tenant');
    }

    const skip = (page - 1) * limit;
    const filter = { tenantId: tenantObjectId, lenderPersonId: personObjectId };

    const [loans, total] = await Promise.all([
      LoanModel.find(filter)
        .populate('borrowerPersonId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanModel.countDocuments(filter)
    ]);

    return {
      loans: loans.map((l: any) => formatLoanDTO(l, person, l.borrowerPersonId)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get Loans Taken by a Person (borrowerPersonId === personId)
   */
  static async getLoansTakenByPerson(
    tenantId: string | Types.ObjectId,
    personId: string,
    page = 1,
    limit = 10
  ) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const personObjectId = new Types.ObjectId(personId);

    // Verify person exists in tenant
    const person = await PersonModel.findOne({ _id: personObjectId, tenantId: tenantObjectId });
    if (!person) {
      throw new NotFoundError('Person not found in this tenant');
    }

    const skip = (page - 1) * limit;
    const filter = { tenantId: tenantObjectId, borrowerPersonId: personObjectId };

    const [loans, total] = await Promise.all([
      LoanModel.find(filter)
        .populate('lenderPersonId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanModel.countDocuments(filter)
    ]);

    return {
      loans: loans.map((l: any) => formatLoanDTO(l, l.lenderPersonId, person)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}
