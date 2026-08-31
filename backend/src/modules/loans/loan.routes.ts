import { Router } from 'express';
import { LoanController } from './loan.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireRoles, requireTenantScope } from '../../common/middleware/authorize.js';
import { UserRole } from '../users/user.types.js';

const router = Router();

// Protect all tenant loan routes with authentication & live tenant status guard
router.use(authenticate);
router.use(requireTenantScope());

// Schedule preview calculation (available to all authenticated roles)
router.post(
  '/preview-schedule',
  requireRoles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.LOAN_OFFICER,
    UserRole.READ_ONLY
  ),
  LoanController.previewSchedule
);

// List Loans (All authenticated tenant roles)
router.get(
  '/',
  requireRoles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.LOAN_OFFICER,
    UserRole.READ_ONLY
  ),
  LoanController.listLoans
);

// Create Loan (TENANT_OWNER, TENANT_ADMIN, LOAN_OFFICER)
router.post(
  '/',
  requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER),
  LoanController.createLoan
);

// Get single Loan details (All roles)
router.get(
  '/:loanId',
  requireRoles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.LOAN_OFFICER,
    UserRole.READ_ONLY
  ),
  LoanController.getLoanById
);

// Get Repayment Schedule for a loan (All roles)
router.get(
  '/:loanId/schedule',
  requireRoles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.LOAN_OFFICER,
    UserRole.READ_ONLY
  ),
  LoanController.getRepaymentSchedule
);

// Update DRAFT Loan (TENANT_OWNER, TENANT_ADMIN, LOAN_OFFICER)
router.patch(
  '/:loanId',
  requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER),
  LoanController.updateDraftLoan
);

// Activate Loan (TENANT_OWNER, TENANT_ADMIN, LOAN_OFFICER)
router.post(
  '/:loanId/activate',
  requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.LOAN_OFFICER),
  LoanController.activateLoan
);

// Cancel Loan (TENANT_OWNER, TENANT_ADMIN only - LOAN_OFFICER cannot cancel)
router.post(
  '/:loanId/cancel',
  requireRoles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN),
  LoanController.cancelLoan
);

export const loanRouter = router;
