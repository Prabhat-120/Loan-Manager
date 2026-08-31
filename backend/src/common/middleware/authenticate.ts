import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.js';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';
import { UserModel } from '../../modules/users/user.model.js';
import { UserStatus } from '../../modules/users/user.types.js';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token missing or invalid format');
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    const user = await UserModel.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (user.status === UserStatus.BLOCKED || user.status === UserStatus.INACTIVE) {
      throw new ForbiddenError('Account is inactive or blocked');
    }

    // Restricted First-Login Token Enforcement
    if (payload.type === 'first_login') {
      const isFirstLoginEndpoint = req.originalUrl.includes('/auth/first-login-change-password');
      if (!isFirstLoginEndpoint) {
        throw new ForbiddenError('First login password change required before accessing platform APIs');
      }
    }

    req.user = {
      id: user._id!.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ? user.tenantId.toString() : undefined,
      status: user.status,
      firstLogin: !!user.firstLogin,
      type: payload.type
    };

    next();
  } catch (error) {
    next(error);
  }
};
