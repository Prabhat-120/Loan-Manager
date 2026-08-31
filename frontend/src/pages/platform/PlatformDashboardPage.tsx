import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformApi } from '../../api/platform-api';
import { Link } from 'react-router-dom';

export const PlatformDashboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['platformDashboard'],
    queryFn: platformApi.getDashboard
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
        Failed to load platform analytics.
      </div>
    );
  }

  const { metrics, recentTenants } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Owner Overview</h1>
        <p className="text-sm text-slate-400">Global SaaS metrics and multi-tenant management</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tenants</span>
          <div className="text-3xl font-extrabold text-white mt-2">{metrics.totalTenants}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active Tenants</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">{metrics.activeTenants}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Suspended Tenants</span>
          <div className="text-3xl font-extrabold text-amber-400 mt-2">{metrics.suspendedTenants}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Total Users</span>
          <div className="text-3xl font-extrabold text-indigo-400 mt-2">{metrics.totalUsers}</div>
        </div>
      </div>

      {/* Subscription Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-sm font-semibold text-slate-300">Active Subscriptions</div>
          <div className="text-2xl font-bold text-white mt-1">{metrics.activeSubscriptions}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-sm font-semibold text-slate-300">Nearing Expiry (30 days)</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{metrics.nearingExpiryTenants}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-sm font-semibold text-slate-300">Expired Subscriptions</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{metrics.expiredSubscriptions}</div>
        </div>
      </div>

      {/* Recent Tenants */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">Recent Tenants</h2>
          <Link to="/platform/tenants" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
            View All Tenants →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Tenant Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-semibold text-white">{tenant.name}</td>
                  <td className="px-4 py-3 text-slate-400">{tenant.slug}</td>
                  <td className="px-4 py-3 text-slate-400">{tenant.contactEmail || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tenant.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : tenant.status === 'SUSPENDED'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
