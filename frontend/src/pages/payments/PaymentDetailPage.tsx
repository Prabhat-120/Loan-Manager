import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { paymentApi } from '../../api/payment-api';
import { useAuth } from '../../context/AuthContext';
import { ReversePaymentModal } from './ReversePaymentModal';

export const PaymentDetailPage: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { user } = useAuth();
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);

  const isOwnerOrAdmin = user?.role === 'TENANT_OWNER' || user?.role === 'TENANT_ADMIN';

  const { data, isLoading, error } = useQuery({
    queryKey: ['paymentDetail', paymentId],
    queryFn: () => paymentApi.getPaymentById(paymentId!),
    enabled: !!paymentId
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
      <div className="p-6 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl text-sm">
        Failed to load payment transaction or record not found.
      </div>
    );
  }

  const { payment, loan, borrower, allocationSummary, scheduleAllocations } = data;

  const getStatusBadgeClass = (status: string) => {
    if (status === 'POSTED') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (status === 'REVERSED') {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
    return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link to="/payments" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
            ← Back to Payments Ledger
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold font-mono text-white">{payment.paymentNumber}</h1>
            <span
              className={`inline-flex px-3 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                payment.status
              )}`}
            >
              {payment.status}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Recorded on {new Date(payment.createdAt || payment.paymentDate).toLocaleString()}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/loans/${loan.id}`}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all"
          >
            📋 View Loan ({loan.loanNumber})
          </Link>

          {isOwnerOrAdmin && payment.status === 'POSTED' && (
            <button
              onClick={() => setIsReverseModalOpen(true)}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-semibold text-xs rounded-xl transition-all"
            >
              ⚠ Reverse Payment
            </button>
          )}
        </div>
      </div>

      {/* Reversal Banner if Payment is REVERSED */}
      {payment.status === 'REVERSED' && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-rose-400 text-sm">
            <span>⚠</span> Transaction Status: REVERSED
          </div>
          <p>
            <strong>Reversed On:</strong>{' '}
            {payment.reversedAt ? new Date(payment.reversedAt).toLocaleString() : 'N/A'}
          </p>
          <p>
            <strong>Reason for Reversal:</strong> {payment.reversalReason || 'No reason specified'}
          </p>
          <p className="text-rose-400/80">
            This transaction has been voided. All principal and interest allocations have been restored to the loan obligations.
          </p>
        </div>
      )}

      {/* Overview Grid: Payment Info + Loan & Borrower */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Payment Summary */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <span className="text-xs text-indigo-400 uppercase font-bold tracking-wider block border-b border-slate-800 pb-2">
            Payment Parameters
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Gross Amount:</span>
              <span className="font-mono font-bold text-white text-sm">
                ₹{parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Date:</span>
              <span className="font-mono text-slate-200">{new Date(payment.paymentDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Method:</span>
              <span className="font-medium text-slate-200">{payment.paymentMethod}</span>
            </div>
            {payment.referenceNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">Reference #:</span>
                <span className="font-mono text-indigo-300">{payment.referenceNumber}</span>
              </div>
            )}
          </div>
          {payment.notes && (
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-slate-500 text-xs block">Notes:</span>
              <p className="text-xs text-slate-300 mt-0.5">{payment.notes}</p>
            </div>
          )}
        </div>

        {/* Loan Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs text-emerald-400 uppercase font-bold tracking-wider">Associated Loan</span>
            <Link to={`/loans/${loan.id}`} className="text-xs text-slate-400 hover:text-white">
              Details →
            </Link>
          </div>
          <div className="text-base font-bold font-mono text-white">{loan.loanNumber}</div>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Loan Type:</span>
              <span className="text-slate-200">{loan.loanType}</span>
            </div>
            <div className="flex justify-between">
              <span>Principal:</span>
              <span className="font-mono text-slate-200">
                ₹{parseFloat(loan.principalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Current Status:</span>
              <span className="text-emerald-400 font-semibold">{loan.status}</span>
            </div>
          </div>
        </div>

        {/* Borrower Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs text-amber-400 uppercase font-bold tracking-wider">Borrower Person</span>
            <Link to={`/persons/${borrower.id}`} className="text-xs text-slate-400 hover:text-white">
              Profile →
            </Link>
          </div>
          <div className="text-base font-bold text-white">{borrower.displayName}</div>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Phone:</span>
              <span className="font-mono text-slate-200">{borrower.phone}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="text-slate-200">{borrower.type}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-emerald-400 font-semibold">{borrower.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Breakdown Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Allocation Breakdown</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Paid</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              ₹{parseFloat(allocationSummary.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Allocated Interest</span>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              ₹{parseFloat(allocationSummary.allocatedInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Allocated Principal</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              ₹{parseFloat(allocationSummary.allocatedPrincipal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Unallocated Excess</span>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              ₹{parseFloat(allocationSummary.unallocatedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Allocations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2 flex justify-between items-center">
          <span>Schedule Installment Allocations</span>
          <span className="text-xs font-normal text-slate-400">{scheduleAllocations.length} installments covered</span>
        </h2>

        {scheduleAllocations.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No schedule allocations recorded (e.g. 100% unallocated payment).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Inst #</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Interest Allocated</th>
                  <th className="px-4 py-3">Principal Allocated</th>
                  <th className="px-4 py-3">Total Installment Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {scheduleAllocations.map((alloc) => (
                  <tr key={alloc.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-white">{alloc.installmentNumber}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {alloc.dueDate ? new Date(alloc.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-amber-400">
                      ₹{parseFloat(alloc.interestAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-emerald-400">
                      ₹{parseFloat(alloc.principalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">
                      ₹{parseFloat(alloc.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reversal Modal */}
      {isReverseModalOpen && (
        <ReversePaymentModal
          payment={payment}
          isOpen={isReverseModalOpen}
          onClose={() => setIsReverseModalOpen(false)}
        />
      )}
    </div>
  );
};
