import { Router } from 'express';
import { PersonController } from './person.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRoles, requireTenantScope } from '../../common/middleware/authorize.js';
import { UserRole } from '../users/user.types.js';

const router = Router();

// Protect all person routes with authentication & live tenant status guard
router.use(authenticate);
router.use(requireTenantScope());

// Search / List Persons (All authenticated tenant roles)
router.get('/', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER, UserRole.READ_ONLY), PersonController.listPersons);

// Lookup-or-create & Create Person
router.post('/lookup-or-create', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER), PersonController.lookupOrCreatePerson);
router.post('/', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER), PersonController.createPerson);

// Single Person Detail & Audit Logs
router.get('/:personId', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER, UserRole.READ_ONLY), PersonController.getPersonById);
router.get('/:personId/audit-logs', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER, UserRole.READ_ONLY), PersonController.getPersonAuditLogs);

// Update Person (TENANT_OWNER, TENANT_ADMIN, LOAN_OFFICER)
router.patch('/:personId', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER), PersonController.updatePerson);

// Update Person Status (TENANT_OWNER, TENANT_ADMIN)
router.patch('/:personId/status', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN), PersonController.updatePersonStatus);

// User Link / Unlink
router.post('/:personId/link-user', requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN), PersonController.linkPersonToUser);
router.post('/:personId/unlink-user', requireRoles(UserRole.TENANT_OWNER), PersonController.unlinkPersonFromUser);

export const personRouter = router;
