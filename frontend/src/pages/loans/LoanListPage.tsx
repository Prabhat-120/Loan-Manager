import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { loanApi } from '../../api/loan-api';
import { useAuth } from '../../context/AuthContext';

export const LoanListPage: React.FC = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const isReadOnly = user?.role === 'READ_ONLY';

  const { data, isLoading, error } = useQuery({
    queryKey: ['loans', search, statusFilter, typeFilter, page, sortBy, sortOrder],
    queryFn: () =>
      loanApi.listLoans({
        search: search || undefined,
        status: statusFilter || undefined,
        loanType: typeFilter || undefined,
        page,
        limit: 10,
        sortBy,
        sortOrder
      })
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'DRAFT':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'PARTIALLY_PAID':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'OVERDUE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'CLOSED':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'CANCELLED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Loan Management</h1>
          <p className="text-sm text-slate-400">Track and manage loans, terms, and repayment schedules</p>
        </div>
        {!isReadOnly && (
          <Link
            to="/loans/new"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 inline-flex items-center gap-2"
          >
            <span>+</span> Create Loan
          </Link>
        )}
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Loan # or Person name..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Loan Type</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            <option value="EMI">EMI (Reducing Balance)</option>
            <option value="INTEREST_ONLY">Interest Only</option>
            <option value="FULL_PAYMENT">Full Payment (Maturity)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Sort By</label>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="createdAt">Date Created</option>
              <option value="principalAmount">Principal Amount</option>
              <option value="startDate">Start Date</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              title="Toggle Sort Direction"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm">
          Failed to load loans list.
        </div>
      )}

      {/* Table & Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : !data || data.loans.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="text-4xl">📄</div>
            <h3 className="text-lg font-semibold text-slate-200">No Loans Found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {search || statusFilter || typeFilter
                ? 'No loans match your search criteria. Try clearing filters.'
                : 'Create your first loan to establish repayment schedules and track balances.'}
            </p>
            {!isReadOnly && !search && !statusFilter && !typeFilter && (
              <Link
                to="/loans/new"
                className="mt-2 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl"
              >
                Create Loan
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Loan #</th>
                  <th className="px-4 py-3">Lender</th>
                  <th className="px-4 py-3">Borrower</th>
                  <th className="px-4 py-3">Principal</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-400">
                      <Link to={`/loans/${loan.id}`} className="hover:underline">
                        {loan.loanNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {loan.lender ? (
                        <Link to={`/persons/${loan.lender.id}`} className="hover:underline text-slate-200">
                          {loan.lender.displayName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {loan.borrower ? (
                        <Link to={`/persons/${loan.borrower.id}`} className="hover:underline text-slate-200">
                          {loan.borrower.displayName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-200">
                      ₹{parseFloat(loan.principalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {loan.interestRate}% p.a.
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <span className="px-2 py-0.5 bg-slate-800 rounded-md font-mono">
                        {loan.loanType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-100">
                      ₹{parseFloat(loan.outstandingTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                          loan.status
                        )}`}
                      >
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {loan.startDate ? new Date(loan.startDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/loans/${loan.id}`}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 mr-3"
                      >
                        View
                      </Link>
                      <Link
                        to={`/loans/${loan.id}/schedule`}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-200"
                      >
                        Schedule
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.pagination.pages > 1 && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <span>
              Showing {data.loans.length} of {data.pagination.total} loans
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-slate-300 font-medium">
                Page {page} of {data.pagination.pages}
              </span>
              <button
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
