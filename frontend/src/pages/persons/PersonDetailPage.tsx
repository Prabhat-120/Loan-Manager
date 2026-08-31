import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { personApi } from '../../api/person-api';
import { loanApi } from '../../api/loan-api';

export const PersonDetailPage: React.FC = () => {
  const { personId } = useParams<{ personId: string }>();

  const { data: person, isLoading, error } = useQuery({
    queryKey: ['personDetail', personId],
    queryFn: () => personApi.getPersonById(personId!),
    enabled: !!personId
  });

  const { data: loansGivenData } = useQuery({
    queryKey: ['personLoansGiven', personId],
    queryFn: () => loanApi.getLoansGivenByPerson(personId!),
    enabled: !!personId
  });

  const { data: loansTakenData } = useQuery({
    queryKey: ['personLoansTaken', personId],
    queryFn: () => loanApi.getLoansTakenByPerson(personId!),
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

  const loansGiven = loansGivenData?.loans || [];
  const loansTaken = loansTakenData?.loans || [];

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

          {/* Quick Loan Statistics */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-500 uppercase font-semibold">Loans Given (Lender)</span>
              <div className="text-lg font-bold text-indigo-400 mt-0.5">{loansGiven.length}</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-500 uppercase font-semibold">Loans Taken (Borrower)</span>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{loansTaken.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Loans Given Section */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2 flex justify-between items-center">
          <span>Loans Given (Lender)</span>
          <span className="text-xs font-normal text-slate-400">{loansGiven.length} records</span>
        </h2>
        {loansGiven.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">No loans given by this person.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2">Loan #</th>
                  <th className="px-3 py-2">Borrower</th>
                  <th className="px-3 py-2">Principal</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {loansGiven.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-indigo-400 font-bold">{l.loanNumber}</td>
                    <td className="px-3 py-2 font-sans text-white">{l.borrower?.displayName || '—'}</td>
                    <td className="px-3 py-2">₹{l.principalAmount}</td>
                    <td className="px-3 py-2 text-slate-400">{l.loanType}</td>
                    <td className="px-3 py-2 font-sans">{l.status}</td>
                    <td className="px-3 py-2 text-right font-sans">
                      <Link to={`/loans/${l.id}`} className="text-indigo-400 hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loans Taken Section */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2 flex justify-between items-center">
          <span>Loans Taken (Borrower)</span>
          <span className="text-xs font-normal text-slate-400">{loansTaken.length} records</span>
        </h2>
        {loansTaken.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">No loans taken by this person.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2">Loan #</th>
                  <th className="px-3 py-2">Lender</th>
                  <th className="px-3 py-2">Principal</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {loansTaken.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-indigo-400 font-bold">{l.loanNumber}</td>
                    <td className="px-3 py-2 font-sans text-white">{l.lender?.displayName || '—'}</td>
                    <td className="px-3 py-2">₹{l.principalAmount}</td>
                    <td className="px-3 py-2 text-slate-400">{l.loanType}</td>
                    <td className="px-3 py-2 font-sans">{l.status}</td>
                    <td className="px-3 py-2 text-right font-sans">
                      <Link to={`/loans/${l.id}`} className="text-indigo-400 hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

