import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../modules/users/user.types.js';
import { TenantStatus } from '../../modules/tenants/tenant.types.js';
import { TenantModel } from '../../modules/tenants/tenant.model.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

export const requireRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions for this operation'));
    }

    next();
  };
};

export const requireTenantScope = () => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // PLATFORM_OWNER operates globally
      if (req.user.role === UserRole.PLATFORM_OWNER) {
        return next();
      }

      if (!req.user.tenantId) {
        throw new ForbiddenError('Tenant scope required for non-platform owner role');
      }

      // Check live database status of Tenant
      const tenant = await TenantModel.findById(req.user.tenantId);
      if (!tenant) {
        throw new ForbiddenError('Tenant associated with user account does not exist');
      }

      if (tenant.status === TenantStatus.SUSPENDED) {
        throw new ForbiddenError('Tenant account is suspended. Contact platform support.');
      }

      if (tenant.status === TenantStatus.INACTIVE) {
        throw new ForbiddenError('Tenant account is inactive.');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
