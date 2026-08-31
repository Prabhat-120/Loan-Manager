import { Router } from 'express';
import { PlatformController } from './platform.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRoles } from '../../common/middleware/authorize.js';
import { UserRole } from '../users/user.types.js';

const router = Router();

// Protect all platform routes for PLATFORM_OWNER role ONLY
router.use(authenticate);
router.use(requireRoles(UserRole.PLATFORM_OWNER));

router.get('/dashboard', PlatformController.getDashboard);
router.get('/tenants', PlatformController.listTenants);
router.post('/tenants', PlatformController.onboardTenant);
router.get('/tenants/:tenantId', PlatformController.getTenantById);
router.patch('/tenants/:tenantId', PlatformController.updateTenant);
router.patch('/tenants/:tenantId/status', PlatformController.updateTenantStatus);
router.patch('/tenants/:tenantId/subscription', PlatformController.updateSubscription);

export const platformRouter = router;
