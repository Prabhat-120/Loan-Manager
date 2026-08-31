import { Router } from 'express';
import { PaymentController } from './payment.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRoles, requireTenantScope } from '../../common/middleware/authorize.js';
import { UserRole } from '../users/user.types.js';

const router = Router();

// Protect all payment routes with authentication and live tenant scope
router.use(authenticate);
router.use(requireTenantScope());

// Preview allocation (read-only calculation for all roles)
router.post(
  '/preview',
  requireRoles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.LOAN_OFFICER,
    UserRole.READ_ONLY
  ),
  PaymentController.preview
);

// List Payments (All authenticated tenant roles)
router.get(
  '/',
  requireRoles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.LOAN_OFFICER,
    UserRole.READ_ONLY
  ),
  PaymentController.list
);

// Create Payment (TENANT_OWNER, TENANT_ADMIN, LOAN_OFFICER - READ_ONLY forbidden)
router.post(
  '/',
  requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER),
  PaymentController.create
);

// Diagnostic reconciliation endpoints (TENANT_OWNER, TENANT_ADMIN)
router.get(
  '/reconcile/tenant',
  requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN),
  PaymentController.reconcileTenant
);

router.get(
  '/reconcile/loan/:loanId',
  requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN),
  PaymentController.reconcileLoan
);

// Get Payment Details (All tenant roles)
router.get(
  '/:paymentId',
  requireRoles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.LOAN_OFFICER,
    UserRole.READ_ONLY
  ),
  PaymentController.getById
);

// Reverse Payment (TENANT_OWNER, TENANT_ADMIN only - LOAN_OFFICER and READ_ONLY forbidden)
router.post(
  '/:paymentId/reverse',
  requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN),
  PaymentController.reverse
);

export const paymentRouter = router;
