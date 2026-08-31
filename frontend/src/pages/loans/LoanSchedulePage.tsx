import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { loanApi } from '../../api/loan-api';

export const LoanSchedulePage: React.FC = () => {
  const { loanId } = useParams<{ loanId: string }>();

  const { data: loanDetail, isLoading: isLoanLoading } = useQuery({
    queryKey: ['loanDetail', loanId],
    queryFn: () => loanApi.getLoanById(loanId!),
    enabled: !!loanId
  });

  const { data: schedule, isLoading: isScheduleLoading, error } = useQuery({
    queryKey: ['loanSchedule', loanId],
    queryFn: () => loanApi.getRepaymentSchedule(loanId!),
    enabled: !!loanId
  });

  const isLoading = isLoanLoading || isScheduleLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm">
        Failed to load repayment schedule.
      </div>
    );
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PENDING':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'PARTIALLY_PAID':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'OVERDUE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            to={loanId ? `/loans/${loanId}` : '/loans'}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            ← Back to Loan Overview
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-white">Repayment Schedule</h1>
            {loanDetail && (
              <span className="font-mono text-xs px-2.5 py-1 bg-slate-800 text-indigo-300 rounded-lg border border-slate-700">
                {loanDetail.loan.loanNumber}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {schedule.length} scheduled installments | Total Payable: ₹
            {loanDetail
              ? parseFloat(loanDetail.financialSummary.totalPayable).toLocaleString('en-IN', {
                  minimumFractionDigits: 2
                })
              : '—'}
          </p>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="text-xs uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Due Date</th>
                <th className="px-3 py-3">Principal</th>
                <th className="px-3 py-3">Interest</th>
                <th className="px-3 py-3">Total Due</th>
                <th className="px-3 py-3 text-emerald-400">Paid Prin</th>
                <th className="px-3 py-3 text-amber-400">Paid Int</th>
                <th className="px-3 py-3">Total Paid</th>
                <th className="px-3 py-3">Remaining</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {schedule.map((item) => (
                <tr key={item.installmentNumber} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-3 font-semibold text-white">{item.installmentNumber}</td>
                  <td className="px-3 py-3 text-slate-300">
                    {new Date(item.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 text-slate-300 font-medium">
                    ₹{parseFloat(item.scheduledPrincipal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-slate-300 font-medium">
                    ₹{parseFloat(item.scheduledInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 font-bold text-white">
                    ₹{parseFloat(item.scheduledAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-emerald-400">
                    ₹{parseFloat(item.paidPrincipal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-amber-400">
                    ₹{parseFloat(item.paidInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-emerald-300 font-semibold">
                    ₹{parseFloat(item.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 font-semibold text-rose-300">
                    ₹{parseFloat(item.remainingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 font-sans">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
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
