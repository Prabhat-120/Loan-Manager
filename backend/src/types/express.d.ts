import { UserRole, UserStatus } from '../modules/users/user.types.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  status: UserStatus;
  firstLogin: boolean;
  type: 'access' | 'first_login';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
