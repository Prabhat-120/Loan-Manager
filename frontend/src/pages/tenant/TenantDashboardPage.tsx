import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '../../api/tenant-api';

export const TenantDashboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tenantDashboard'],
    queryFn: tenantApi.getDashboard
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
        Failed to load tenant dashboard.
      </div>
    );
  }

  const { tenant, subscription, stats } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{tenant.name} Dashboard</h1>
        <p className="text-sm text-slate-400">Tenant status: {tenant.status} | Currency: {tenant.currency}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Active Users</span>
          <div className="text-3xl font-extrabold text-white mt-2">
            {stats.userCount} <span className="text-xs text-slate-500 font-normal">/ {subscription?.limits.maxUsers || 5} max</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Total People</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">
            {stats.personCount} <span className="text-xs text-slate-500 font-normal">/ {subscription?.limits.maxPeople || 200} max</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Active Loans</span>
          <div className="text-3xl font-extrabold text-amber-400 mt-2">
            {stats.activeLoanCount} <span className="text-xs text-slate-500 font-normal">/ {subscription?.limits.maxActiveLoans || 50} max</span>
          </div>
        </div>
      </div>

      {/* Subscription Card */}
      {subscription && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-2">Current Subscription</h2>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm text-slate-300">
            <div>
              <span className="font-semibold text-indigo-400">{subscription.plan} Plan</span> ({subscription.billingCycle})
            </div>
            <div className="text-slate-400">
              Renews / Expires: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
