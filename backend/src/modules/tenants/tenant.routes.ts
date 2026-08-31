import { Router } from 'express';
import { TenantController } from './tenant.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRoles, requireTenantScope } from '../../common/middleware/authorize.js';
import { UserRole } from '../users/user.types.js';

const router = Router();

// Protect all tenant routes with authentication & live tenant status guard
router.use(authenticate);
router.use(requireTenantScope());

// Tenant Profile & Dashboard
router.get('/', TenantController.getTenantProfile);
router.patch('/', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN), TenantController.updateTenantProfile);
router.get('/dashboard', TenantController.getDashboard);
router.get('/subscription', TenantController.getSubscription);

// Tenant User Management
router.get('/users', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN), TenantController.listUsers);
router.post('/users', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN), TenantController.createUser);
router.get('/users/:userId', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN), TenantController.getUserById);
router.patch('/users/:userId/role', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN), TenantController.updateUserRole);
router.patch('/users/:userId/status', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN), TenantController.updateUserStatus);
router.post('/users/:userId/link-person', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN), TenantController.linkPersonToUser);

// Person Scenario
router.post('/persons/lookup-or-create', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER), TenantController.lookupOrCreatePerson);

export const tenantRouter = router;
