import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { LoansPage } from '../pages/LoansPage';
import { PaymentsPage } from '../pages/PaymentsPage';
import { PersonsPage } from '../pages/PersonsPage';
import { TenantsPage } from '../pages/TenantsPage';
import { UsersPage } from '../pages/UsersPage';
import { ReportsPage } from '../pages/ReportsPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { AuditPage } from '../pages/AuditPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'loans', element: <LoansPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'persons', element: <PersonsPage /> },
      { path: 'tenants', element: <TenantsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: '*', element: <NotFoundPage /> }
    ]
  }
]);
