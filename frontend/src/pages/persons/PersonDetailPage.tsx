import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { personApi } from '../../api/person-api';

export const PersonDetailPage: React.FC = () => {
  const { personId } = useParams<{ personId: string }>();

  const { data: person, isLoading, error } = useQuery({
    queryKey: ['personDetail', personId],
    queryFn: () => personApi.getPersonById(personId!),
    enabled: !!personId
  });

  const { data: auditLogsData } = useQuery({
    queryKey: ['personAuditLogs', personId],
    queryFn: () => personApi.getPersonAuditLogs(personId!),
    enabled: !!personId
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
        Failed to load Person details or Person does not exist.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/persons" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
            ← Back to People Directory
          </Link>
          <h1 className="text-2xl font-bold text-white mt-1">{person.displayName}</h1>
          <p className="text-sm text-slate-400">
            Type: {person.type} | Status:{' '}
            <span className={person.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}>
              {person.status}
            </span>
          </p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Profile Information</h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Phone</span>
              <div className="font-mono text-white mt-0.5">{person.phone}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Normalized E.164</span>
              <div className="font-mono text-white mt-0.5">{person.normalizedPhone}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Email</span>
              <div className="text-white mt-0.5">{person.email || 'Not provided'}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Occupation</span>
              <div className="text-white mt-0.5">{person.occupation || 'Not provided'}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Created Date</span>
              <div className="text-white mt-0.5">
                {person.createdAt ? new Date(person.createdAt).toLocaleDateString() : '-'}
              </div>
            </div>
          </div>

          {person.notes && (
            <div className="pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-semibold">Notes</span>
              <p className="text-sm text-slate-300 mt-1">{person.notes}</p>
            </div>
          )}
        </div>

        {/* User Account Link Status */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Platform Account Link</h2>

          {person.hasUserAccount ? (
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl space-y-2">
              <div className="text-xs text-indigo-400 uppercase font-bold tracking-wider">Linked Platform User</div>
              <div className="font-semibold text-white">{person.linkedUserEmail || person.userId}</div>
              <p className="text-xs text-slate-400">
                This Person is linked to an active login User account on the platform.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">No User Account</div>
              <p className="text-sm text-slate-300">
                This Person does not currently have a platform login account.
              </p>
            </div>
          )}

          {/* Financial Summary Placeholder Notice */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300 uppercase tracking-wider block">Financial History</span>
            <p>Loans given / taken and payment history will appear here when Loan Module is active.</p>
          </div>
        </div>
      </div>

      {/* Paginated Audit Logs */}
      {auditLogsData && auditLogsData.auditLogs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Activity Audit History</h2>
          <div className="divide-y divide-slate-800">
            {auditLogsData.auditLogs.map((log) => (
              <div key={log._id} className="py-3 flex justify-between items-center text-sm">
                <div>
                  <span className="font-semibold text-indigo-400">{log.action}</span> - {log.entity}
                  <span className="text-slate-400 text-xs block">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
