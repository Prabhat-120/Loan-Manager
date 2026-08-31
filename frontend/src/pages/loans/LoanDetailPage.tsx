import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loanApi } from '../../api/loan-api';
import { useAuth } from '../../context/AuthContext';

export const LoanDetailPage: React.FC = () => {
  const { loanId } = useParams<{ loanId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const isReadOnly = user?.role === 'READ_ONLY';
  const isOfficer = user?.role === 'LOAN_OFFICER';

  const { data, isLoading, error } = useQuery({
    queryKey: ['loanDetail', loanId],
    queryFn: () => loanApi.getLoanById(loanId!),
    enabled: !!loanId
  });

  const activateMutation = useMutation({
    mutationFn: () => loanApi.activateLoan(loanId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanDetail', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.error?.message || err.message || 'Failed to activate loan');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: () => loanApi.cancelLoan(loanId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanDetail', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.error?.message || err.message || 'Failed to cancel loan');
    }
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
      <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm">
        Failed to load loan details or loan does not exist.
      </div>
    );
  }

  const { loan, lender, borrower, financialSummary, scheduleSummary } = data;

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
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link to="/loans" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
            ← Back to Loans List
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold font-mono text-white">{loan.loanNumber}</h1>
            <span
              className={`inline-flex px-3 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                loan.status
              )}`}
            >
              {loan.status}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Type: {loan.loanType} | Frequency: {loan.paymentFrequency} | Term: {loan.termMonths} Months
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/loans/${loan.id}/schedule`}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all"
          >
            📅 View Full Schedule ({scheduleSummary.totalInstallments})
          </Link>

          {!isReadOnly && loan.status === 'DRAFT' && (
            <button
              disabled={activateMutation.isPending}
              onClick={() => activateMutation.mutate()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {activateMutation.isPending ? 'Activating...' : '✓ Activate Loan'}
            </button>
          )}

          {!isReadOnly && !isOfficer && loan.status !== 'CLOSED' && loan.status !== 'CANCELLED' && (
            <button
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling...' : '✕ Cancel Loan'}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm">
          {actionError}
        </div>
      )}

      {/* Participants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lender Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs text-indigo-400 uppercase font-bold tracking-wider">Lender (Funding)</span>
            <Link to={`/persons/${lender.id}`} className="text-xs text-slate-400 hover:text-white">
              View Profile →
            </Link>
          </div>
          <div className="text-lg font-bold text-white">{lender.displayName}</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>
              <span className="text-slate-500 block">Phone:</span>
              <span className="font-mono text-slate-300">{lender.phone}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Type:</span>
              <span className="text-slate-300">{lender.type}</span>
            </div>
          </div>
        </div>

        {/* Borrower Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs text-emerald-400 uppercase font-bold tracking-wider">Borrower (Receiving)</span>
            <Link to={`/persons/${borrower.id}`} className="text-xs text-slate-400 hover:text-white">
              View Profile →
            </Link>
          </div>
          <div className="text-lg font-bold text-white">{borrower.displayName}</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>
              <span className="text-slate-500 block">Phone:</span>
              <span className="font-mono text-slate-300">{borrower.phone}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Type:</span>
              <span className="text-slate-300">{borrower.type}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Financial Breakdown</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Principal</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              ₹{parseFloat(financialSummary.principal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Interest Rate</span>
            <div className="text-xl font-bold font-mono text-slate-200 mt-1">
              {financialSummary.interestRate}% p.a.
            </div>
            <span className="text-xs text-slate-500">{loan.interestCalculationMethod}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Interest</span>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              ₹{parseFloat(financialSummary.totalInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Payable</span>
            <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
              ₹{parseFloat(financialSummary.totalPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-800/60">
          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Paid</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              ₹{parseFloat(financialSummary.totalPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Outstanding Principal</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              ₹{parseFloat(financialSummary.outstandingPrincipal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Outstanding Interest</span>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              ₹{parseFloat(financialSummary.outstandingInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Outstanding Total</span>
            <div className="text-xl font-bold font-mono text-rose-400 mt-1">
              ₹{parseFloat(financialSummary.outstandingTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Dates & Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Timeline & Conditions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-300">
          <div>
            <span className="text-slate-500 uppercase font-semibold block">Start Date</span>
            <div className="font-mono mt-1 text-sm text-white">
              {loan.startDate ? new Date(loan.startDate).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold block">First Due Date</span>
            <div className="font-mono mt-1 text-sm text-white">
              {loan.firstDueDate ? new Date(loan.firstDueDate).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold block">Maturity Date</span>
            <div className="font-mono mt-1 text-sm text-white">
              {loan.maturityDate ? new Date(loan.maturityDate).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold block">Created At</span>
            <div className="font-mono mt-1 text-sm text-white">
              {loan.createdAt ? new Date(loan.createdAt).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>

        {loan.notes && (
          <div className="pt-3 border-t border-slate-800/60">
            <span className="text-xs text-slate-500 uppercase font-semibold block">Notes</span>
            <p className="text-sm text-slate-300 mt-1">{loan.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};
