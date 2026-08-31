import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service.js';
import { ReconciliationService } from './reconciliation.service.js';
import {
  createPaymentSchema,
  previewPaymentSchema,
  reversePaymentSchema,
  listPaymentsQuerySchema
} from './payment.validation.js';

export class PaymentController {
  static async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = previewPaymentSchema.parse(req.body);
      const tenantId = req.user!.tenantId!;

      const result = await PaymentService.previewPaymentAllocation(tenantId, validatedInput);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = createPaymentSchema.parse(req.body);
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id!;
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await PaymentService.createPayment(
        tenantId,
        validatedInput,
        userId,
        idempotencyKey,
        ipAddress,
        userAgent
      );

      const statusCode = result.isDuplicate ? 200 : 201;

      res.status(statusCode).json({
        success: true,
        data: result.payment,
        isDuplicate: result.isDuplicate || false
      });
    } catch (error) {
      next(error);
    }
  }

  static async reverse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = reversePaymentSchema.parse(req.body);
      const tenantId = req.user!.tenantId!;
      const paymentId = req.params.paymentId;
      const userId = req.user!.id!;

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await PaymentService.reversePayment(
        tenantId,
        paymentId,
        validatedInput,
        userId,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedQuery = listPaymentsQuerySchema.parse(req.query);
      const tenantId = req.user!.tenantId!;

      const result = await PaymentService.listPayments(tenantId, validatedQuery);

      res.status(200).json({
        success: true,
        data: result.payments,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const paymentId = req.params.paymentId;

      const result = await PaymentService.getPaymentById(tenantId, paymentId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLoanHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const loanId = req.params.loanId;

      const result = await PaymentService.getLoanPaymentHistory(tenantId, loanId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async reconcileLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const loanId = req.params.loanId;

      const result = await ReconciliationService.reconcileLoanFinancials(tenantId, loanId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async reconcileTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;

      const result = await ReconciliationService.reconcileTenantFinancials(tenantId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
