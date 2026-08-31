import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchReadiness } from '../api/health-api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Activity, Database, CheckCircle2, RefreshCw } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const {
    data: health,
    isLoading: loadingHealth,
    refetch: refetchHealth
  } = useQuery({
    queryKey: ['health-dashboard'],
    queryFn: fetchHealth
  });

  const {
    data: readiness,
    isLoading: loadingReadiness,
    refetch: refetchReadiness
  } = useQuery({
    queryKey: ['readiness-dashboard'],
    queryFn: fetchReadiness
  });

  const handleRefresh = () => {
    refetchHealth();
    refetchReadiness();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">System Dashboard</h2>
          <p className="text-sm text-slate-400">
            Loan Management SaaS Foundation & Module Readiness Overview
          </p>
        </div>
        <Button variant="secondary" onClick={handleRefresh} className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Probes</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Backend Liveness Status" subtitle="GET /health probe check">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-400" /> Server Status
              </span>
              {loadingHealth ? (
                <Badge variant="neutral">Checking...</Badge>
              ) : health?.status === 'ok' ? (
                <Badge variant="success">HTTP 200 OK</Badge>
              ) : (
                <Badge variant="danger">Offline</Badge>
              )}
            </div>

            {health && (
              <div className="bg-slate-900/60 p-3 rounded-lg text-xs space-y-1 font-mono border border-slate-800">
                <p><span className="text-slate-500">Uptime:</span> {Math.floor(health.uptime)} seconds</p>
                <p><span className="text-slate-500">Timestamp:</span> {health.timestamp}</p>
              </div>
            )}
          </div>
        </Card>

        <Card title="MongoDB Readiness Status" subtitle="GET /health/ready database probe check">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" /> Database Connection
              </span>
              {loadingReadiness ? (
                <Badge variant="neutral">Checking...</Badge>
              ) : readiness?.status === 'ready' ? (
                <Badge variant="success">Mongoose Ready</Badge>
              ) : (
                <Badge variant="warning">Disconnected</Badge>
              )}
            </div>

            {readiness && (
              <div className="bg-slate-900/60 p-3 rounded-lg text-xs space-y-1 font-mono border border-slate-800">
                <p><span className="text-slate-500">State:</span> {readiness.db}</p>
                <p><span className="text-slate-500">Checked At:</span> {readiness.timestamp}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Architectural Module Registry" subtitle="Feature modules scheduled for future iterations">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'auth', title: 'Authentication', branch: 'feature/authentication' },
            { name: 'users', title: 'User Management', branch: 'feature/users' },
            { name: 'tenants', title: 'Multi-Tenancy', branch: 'feature/tenants' },
            { name: 'persons', title: 'Borrower Profiles', branch: 'feature/persons' },
            { name: 'loans', title: 'Loan Lifecycle', branch: 'feature/loans' },
            { name: 'payments', title: 'Payment Processing', branch: 'feature/payments' },
            { name: 'reports', title: 'Reports & Export', branch: 'feature/reports' },
            { name: 'notifications', title: 'Notifications', branch: 'feature/notifications' },
            { name: 'audit', title: 'Audit Trail', branch: 'feature/audit' }
          ].map((mod) => (
            <div key={mod.name} className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">{mod.title}</p>
                <p className="text-xs text-slate-500 font-mono">{mod.branch}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-slate-600" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
