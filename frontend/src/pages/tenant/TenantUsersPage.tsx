import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi, TenantUserSummary } from '../../api/tenant-api';

export const TenantUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('LOAN_OFFICER');
  const [inviteResult, setInviteResult] = useState<{ temporaryPassword: string; warning: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['tenantUsers'],
    queryFn: tenantApi.listUsers
  });

  const inviteMutation = useMutation({
    mutationFn: (input: { email: string; role: string }) => tenantApi.inviteUser(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenantUsers'] });
      queryClient.invalidateQueries({ queryKey: ['tenantDashboard'] });
      setInviteResult({
        temporaryPassword: data.temporaryPassword,
        warning: data.warning
      });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to invite user');
    }
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    inviteMutation.mutate({ email, role });
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await tenantApi.updateUserRole(userId, newRole);
      queryClient.invalidateQueries({ queryKey: ['tenantUsers'] });
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await tenantApi.updateUserStatus(userId, nextStatus);
      queryClient.invalidateQueries({ queryKey: ['tenantUsers'] });
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-sm text-slate-400">Manage tenant accounts, roles, and status</p>
        </div>
        <button
          onClick={() => {
            setIsInviteOpen(true);
            setInviteResult(null);
            setError(null);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20"
        >
          + Invite User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-4">User Email</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">First Login</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users?.map((u: TenantUserSummary) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-semibold text-white">{u.email}</td>
                    <td className="px-5 py-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="TENANT_OWNER">TENANT_OWNER</option>
                        <option value="TENANT_ADMIN">TENANT_ADMIN</option>
                        <option value="LOAN_OFFICER">LOAN_OFFICER</option>
                        <option value="READ_ONLY">READ_ONLY</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {u.firstLogin ? 'Pending' : 'Completed'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleStatusToggle(u.id, u.status)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition-colors"
                      >
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl text-slate-100">
            <h2 className="text-xl font-bold mb-4">Invite New User</h2>

            {inviteResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
                  User account created!
                </div>
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="text-xs text-amber-400 uppercase font-bold tracking-wider">Temporary Password</div>
                  <div className="font-mono text-lg font-bold text-white bg-slate-950 p-3 rounded-lg border border-slate-800 select-all">
                    {inviteResult.temporaryPassword}
                  </div>
                  <p className="text-xs text-amber-300">{inviteResult.warning}</p>
                </div>
                <button
                  onClick={() => setIsInviteOpen(false)}
                  className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">User Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="officer@tenant.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="TENANT_OWNER">TENANT_OWNER</option>
                    <option value="TENANT_ADMIN">TENANT_ADMIN</option>
                    <option value="LOAN_OFFICER">LOAN_OFFICER</option>
                    <option value="READ_ONLY">READ_ONLY</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {inviteMutation.isPending ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
