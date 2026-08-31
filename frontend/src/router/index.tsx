import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { LoansPage } from '../pages/LoansPage';
import { PaymentsPage } from '../pages/PaymentsPage';
import { TenantsPage } from '../pages/TenantsPage';
import { UsersPage } from '../pages/UsersPage';
import { ReportsPage } from '../pages/ReportsPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { AuditPage } from '../pages/AuditPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { FirstLoginChangePasswordPage } from '../pages/auth/FirstLoginChangePasswordPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { UnauthorizedPage } from '../pages/auth/UnauthorizedPage';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RoleGuard } from '../components/auth/RoleGuard';
import { PlatformDashboardPage } from '../pages/platform/PlatformDashboardPage';
import { TenantListPage } from '../pages/platform/TenantListPage';
import { TenantDashboardPage } from '../pages/tenant/TenantDashboardPage';
import { TenantUsersPage } from '../pages/tenant/TenantUsersPage';

import { PersonListPage } from '../pages/persons/PersonListPage';
import { PersonDetailPage } from '../pages/persons/PersonDetailPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/change-password-first', element: <FirstLoginChangePasswordPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'platform/dashboard',
        element: (
          <RoleGuard allowedRoles={['PLATFORM_OWNER']}>
            <PlatformDashboardPage />
          </RoleGuard>
        )
      },
      {
        path: 'platform/tenants',
        element: (
          <RoleGuard allowedRoles={['PLATFORM_OWNER']}>
            <TenantListPage />
          </RoleGuard>
        )
      },
      { path: 'tenant/dashboard', element: <TenantDashboardPage /> },
      {
        path: 'tenant/users',
        element: (
          <RoleGuard allowedRoles={['TENANT_OWNER', 'TENANT_ADMIN']}>
            <TenantUsersPage />
          </RoleGuard>
        )
      },
      { path: 'loans', element: <LoansPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'persons', element: <PersonListPage /> },
      { path: 'persons/:personId', element: <PersonDetailPage /> },
      { path: 'tenants', element: <TenantsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: '*', element: <NotFoundPage /> }
    ]
  }
]);
