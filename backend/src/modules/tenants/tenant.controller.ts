import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service.js';
import { TenantUserController } from '../users/tenant-user.controller.js';
import { TenantPersonService } from '../persons/tenant-person.service.js';
import { updateTenantProfileSchema } from './tenant.validation.js';
import { SubscriptionModel } from './subscription.model.js';
import { formatSubscriptionDTO } from '../../common/utils/dto.js';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';
import { UserRole } from '../users/user.types.js';

export class TenantController {
  static async getTenantProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await TenantService.getTenantById(req.user!.tenantId!);
      res.status(200).json({ success: true, data: data.tenant });
    } catch (error) {
      next(error);
    }
  }

  static async updateTenantProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateTenantProfileSchema.parse(req.body);
      const data = await TenantService.updateTenant(req.user!.tenantId!, validated, req.user?.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await TenantService.getTenantDashboardMetrics(req.user!.tenantId!);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sub = await SubscriptionModel.findOne({ tenantId: req.user!.tenantId! });
      if (!sub) {
        throw new NotFoundError('Subscription not found');
      }
      res.status(200).json({ success: true, data: formatSubscriptionDTO(sub) });
    } catch (error) {
      next(error);
    }
  }

  // Tenant User Management Delegation
  static listUsers = TenantUserController.listTenantUsers;
  static createUser = TenantUserController.createTenantUser;
  static getUserById = TenantUserController.getTenantUserById;
  static updateUserRole = TenantUserController.updateTenantUserRole;
  static updateUserStatus = TenantUserController.updateTenantUserStatus;

  // Person Phone Scenario & Linking
  static async lookupOrCreatePerson(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Forbidden for READ_ONLY role
      if (req.user!.role === UserRole.READ_ONLY) {
        throw new ForbiddenError('READ_ONLY role cannot perform person lookup or creation.');
      }
      const data = await TenantPersonService.lookupOrCreatePerson(req.user!.tenantId!, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async linkPersonToUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { personId } = req.body;
      const data = await TenantPersonService.linkPersonToUser(req.user!.tenantId!, userId, personId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
