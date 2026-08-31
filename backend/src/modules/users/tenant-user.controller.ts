import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from './user.model.js';
import { UserRole, UserStatus } from './user.types.js';
import { PersonModel } from '../persons/person.model.js';
import { AuditLogModel } from '../audit/audit-log.model.js';
import { AuditAction, AuditScope } from '../audit/audit-log.types.js';
import { SubscriptionLimitService } from '../tenants/subscription.service.js';
import { TenantService } from '../tenants/tenant.service.js';
import {
  inviteTenantUserSchema,
  updateTenantUserRoleSchema,
  updateTenantUserStatusSchema
} from '../tenants/tenant.validation.js';
import { generateRandomToken } from '../../common/utils/token.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';
import { formatUserDTO } from '../../common/utils/dto.js';
import { Types } from 'mongoose';

export class TenantUserController {
  /**
   * List users for current tenant
   */
  static async listTenantUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const users = await UserModel.find({ tenantId, role: { $ne: UserRole.PLATFORM_OWNER } }).sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: users.map(formatUserDTO) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Invite / create new user within tenant
   */
  static async createTenantUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const validated = inviteTenantUserSchema.parse(req.body);

      // Enforce subscription user limit
      const limitCheck = await SubscriptionLimitService.checkUserLimit(tenantId);
      if (!limitCheck.allowed) {
        throw new ForbiddenError(`Tenant has reached maximum active user limit (${limitCheck.max}). Upgrade plan to add more users.`);
      }

      // Role boundary check: TENANT_ADMIN cannot create TENANT_OWNER
      if (req.user!.role === UserRole.TENANT_ADMIN && validated.role === UserRole.TENANT_OWNER) {
        throw new ForbiddenError('TENANT_ADMIN cannot create or assign TENANT_OWNER role.');
      }

      const existingUser = await UserModel.findOne({ email: validated.email.toLowerCase() });
      if (existingUser) {
        throw new BadRequestError(`Email '${validated.email}' is already registered.`);
      }

      // Check Person linking if personId provided
      let personObjectId: Types.ObjectId | undefined;
      if (validated.personId) {
        const person = await PersonModel.findOne({ _id: validated.personId, tenantId });
        if (!person) {
          throw new NotFoundError('Person not found in this tenant');
        }
        if (person.userId) {
          throw new BadRequestError('This Person is already linked to another User account');
        }
        personObjectId = person._id;
      }

      const tempPassword = `UserPass!${generateRandomToken().substring(0, 8)}`;
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const user = await UserModel.create({
        tenantId: new Types.ObjectId(tenantId),
        personId: personObjectId,
        email: validated.email.toLowerCase(),
        passwordHash,
        role: validated.role,
        status: UserStatus.ACTIVE,
        firstLogin: true
      });

      // Link Person to User if personObjectId provided
      if (personObjectId) {
        await PersonModel.updateOne({ _id: personObjectId, tenantId }, { userId: user._id });
      }

      await AuditLogModel.create({
        scope: AuditScope.TENANT,
        tenantId: new Types.ObjectId(tenantId),
        userId: new Types.ObjectId(req.user!.id),
        action: AuditAction.CREATE,
        entity: 'User',
        entityId: user._id.toString(),
        changes: { email: user.email, role: user.role }
      });

      res.status(201).json({
        success: true,
        data: {
          user: formatUserDTO(user),
          temporaryPassword: tempPassword,
          warning: 'This temporary password is provided ONCE and cannot be retrieved later.'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single user details in tenant
   */
  static async getTenantUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const user = await UserModel.findOne({ _id: req.params.userId, tenantId });
      if (!user) {
        throw new NotFoundError('User not found in this tenant');
      }
      res.status(200).json({ success: true, data: formatUserDTO(user) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user role
   */
  static async updateTenantUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const targetUserId = req.params.userId;
      const validated = updateTenantUserRoleSchema.parse(req.body);

      const targetUser = await UserModel.findOne({ _id: targetUserId, tenantId });
      if (!targetUser) {
        throw new NotFoundError('User not found in this tenant');
      }

      // Role boundary checks
      if (req.user!.role === UserRole.TENANT_ADMIN) {
        if (targetUser.role === UserRole.TENANT_OWNER) {
          throw new ForbiddenError('TENANT_ADMIN cannot modify a TENANT_OWNER account.');
        }
        if (validated.role === UserRole.TENANT_OWNER) {
          throw new ForbiddenError('TENANT_ADMIN cannot assign TENANT_OWNER role.');
        }
      }

      // Last Owner Protection check
      if (targetUser.role === UserRole.TENANT_OWNER && validated.role !== UserRole.TENANT_OWNER) {
        await TenantService.verifyLastOwnerProtection(tenantId, targetUserId);
      }

      const previousRole = targetUser.role;
      targetUser.role = validated.role;
      await targetUser.save();

      await AuditLogModel.create({
        scope: AuditScope.TENANT,
        tenantId: new Types.ObjectId(tenantId),
        userId: new Types.ObjectId(req.user!.id),
        action: AuditAction.UPDATE,
        entity: 'UserRole',
        entityId: targetUser._id.toString(),
        changes: { previousRole, newRole: validated.role }
      });

      res.status(200).json({ success: true, data: formatUserDTO(targetUser) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user status (Activate / Deactivate)
   */
  static async updateTenantUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const targetUserId = req.params.userId;
      const validated = updateTenantUserStatusSchema.parse(req.body);

      const targetUser = await UserModel.findOne({ _id: targetUserId, tenantId });
      if (!targetUser) {
        throw new NotFoundError('User not found in this tenant');
      }

      // Role boundary check: TENANT_ADMIN cannot modify TENANT_OWNER
      if (req.user!.role === UserRole.TENANT_ADMIN && targetUser.role === UserRole.TENANT_OWNER) {
        throw new ForbiddenError('TENANT_ADMIN cannot modify a TENANT_OWNER account.');
      }

      // Last Owner Protection check if deactivating
      if (validated.status !== UserStatus.ACTIVE && targetUser.role === UserRole.TENANT_OWNER) {
        await TenantService.verifyLastOwnerProtection(tenantId, targetUserId);
      }

      const previousStatus = targetUser.status;
      targetUser.status = validated.status;
      await targetUser.save();

      await AuditLogModel.create({
        scope: AuditScope.TENANT,
        tenantId: new Types.ObjectId(tenantId),
        userId: new Types.ObjectId(req.user!.id),
        action: AuditAction.STATUS_CHANGE,
        entity: 'UserStatus',
        entityId: targetUser._id.toString(),
        changes: { previousStatus, newStatus: validated.status }
      });

      res.status(200).json({ success: true, data: formatUserDTO(targetUser) });
    } catch (error) {
      next(error);
    }
  }
}
