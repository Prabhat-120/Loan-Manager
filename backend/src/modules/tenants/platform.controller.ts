import { Request, Response, NextFunction } from 'express';
import { TenantService, OnboardTenantInput } from './tenant.service.js';
import {
  createTenantOnboardingSchema,
  updateTenantProfileSchema,
  updateTenantStatusSchema,
  updateSubscriptionSchema
} from './tenant.validation.js';

export class PlatformController {
  static async getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await TenantService.getPlatformDashboardMetrics();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async listTenants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, status, page, limit } = req.query;
      const data = await TenantService.listTenants({
        search: search as string,
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async onboardTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createTenantOnboardingSchema.parse(req.body);
      const data = await TenantService.onboardTenant(validated as unknown as OnboardTenantInput, req.user?.id);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getTenantById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await TenantService.getTenantById(req.params.tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updateTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateTenantProfileSchema.parse(req.body);
      const data = await TenantService.updateTenant(req.params.tenantId, validated, req.user?.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updateTenantStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateTenantStatusSchema.parse(req.body);
      const data = await TenantService.updateTenantStatus(req.params.tenantId, validated.status, req.user?.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updateSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateSubscriptionSchema.parse(req.body);
      const data = await TenantService.updateSubscription(req.params.tenantId, validated, req.user?.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
