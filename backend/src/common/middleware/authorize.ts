import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../modules/users/user.types.js';
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
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (req.user.role !== UserRole.PLATFORM_OWNER && !req.user.tenantId) {
      return next(new ForbiddenError('Tenant scope required for non-platform owner role'));
    }

    next();
  };
};
