import { Request, Response, NextFunction } from 'express';
import { LoanService } from './loan.service.js';
import {
  createLoanSchema,
  updateDraftLoanSchema,
  listLoansQuerySchema,
  previewScheduleSchema
} from './loan.validation.js';
import { calculateLoanTotals } from './calculations/calculations.js';

export class LoanController {
  /**
   * Create a new Loan (DRAFT by default)
   */
  static async createLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createLoanSchema.parse(req.body);
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id;

      const loan = await LoanService.createLoan(tenantId, validated, userId);
      res.status(201).json({ success: true, data: loan });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List Loans with filters & pagination
   */
  static async listLoans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedQuery = listLoansQuerySchema.parse(req.query);
      const tenantId = req.user!.tenantId!;

      const result = await LoanService.listLoans(tenantId, validatedQuery);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single Loan by ID
   */
  static async getLoanById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const tenantId = req.user!.tenantId!;

      const loan = await LoanService.getLoanById(tenantId, loanId);
      res.status(200).json({ success: true, data: loan });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update DRAFT Loan terms
   */
  static async updateDraftLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const validated = updateDraftLoanSchema.parse(req.body);
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id;

      const updated = await LoanService.updateDraftLoan(tenantId, loanId, validated, userId);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Activate Loan (DRAFT -> ACTIVE)
   */
  static async activateLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id;

      const activated = await LoanService.activateLoan(tenantId, loanId, userId);
      res.status(200).json({ success: true, data: activated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel Loan
   */
  static async cancelLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id;

      const cancelled = await LoanService.cancelLoan(tenantId, loanId, userId);
      res.status(200).json({ success: true, data: cancelled });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Repayment Schedule for a Loan
   */
  static async getRepaymentSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const tenantId = req.user!.tenantId!;

      const schedule = await LoanService.getRepaymentSchedule(tenantId, loanId);
      res.status(200).json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Preview Schedule (pure calculation endpoint for frontend preview)
   */
  static async previewSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = previewScheduleSchema.parse(req.body);
      const result = calculateLoanTotals({
        loanType: validated.loanType,
        principalAmount: validated.principalAmount,
        annualInterestRate: validated.annualInterestRate,
        interestCalculationMethod: validated.interestCalculationMethod,
        termMonths: validated.termMonths,
        startDate: validated.startDate,
        firstDueDate: validated.firstDueDate,
        paymentFrequency: validated.paymentFrequency
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Loans Given by a Person
   */
  static async getLoansGivenByPerson(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { personId } = req.params;
      const tenantId = req.user!.tenantId!;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const result = await LoanService.getLoansGivenByPerson(tenantId, personId, page, limit);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Loans Taken by a Person
   */
  static async getLoansTakenByPerson(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { personId } = req.params;
      const tenantId = req.user!.tenantId!;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const result = await LoanService.getLoansTakenByPerson(tenantId, personId, page, limit);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
