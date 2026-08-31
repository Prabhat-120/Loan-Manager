import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { paymentApi, PaymentMethodType, PaymentStatusType } from '../../api/payment-api';
import { useAuth } from '../../context/AuthContext';

export const PaymentListPage: React.FC = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isReadOnly = user?.role === 'READ_ONLY';

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', page, limit, paymentMethod, status, referenceNumber, dateFrom, dateTo],
    queryFn: () =>
      paymentApi.listPayments({
        page,
        limit,
        paymentMethod: paymentMethod ? (paymentMethod as PaymentMethodType) : undefined,
        status: status ? (status as PaymentStatusType) : undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      })
  });

  const getStatusBadge = (st: string) => {
    if (st === 'POSTED') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (st === 'REVERSED') {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
    return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>💳</span> Payments Ledger
          </h1>
          <p className="text-sm text-slate-400">
            Authoritative transactional history, interest & principal allocations
          </p>
        </div>

        {!isReadOnly && (
          <Link
            to="/payments/new"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5"
          >
            <span>+</span> Record Payment
          </Link>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Search Reference #</label>
            <input
              type="text"
              placeholder="e.g. UPI-9988..."
              value={referenceNumber}
              onChange={(e) => {
                setReferenceNumber(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="POSTED">POSTED</option>
              <option value="REVERSED">REVERSED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Payments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-400 text-sm">Failed to load payments ledger.</div>
        ) : data?.data && data.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Payment #</th>
                  <th className="px-4 py-3">Loan #</th>
                  <th className="px-4 py-3">Borrower</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Alloc Interest</th>
                  <th className="px-4 py-3">Alloc Principal</th>
                  <th className="px-4 py-3">Unallocated</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {data.data.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-indigo-400">
                      <Link to={`/payments/${pmt.id}`} className="hover:underline">
                        {pmt.paymentNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      <Link to={`/loans/${pmt.loanId}`} className="hover:text-indigo-300">
                        {pmt.loanNumber || pmt.loanId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-sans text-white">{pmt.borrowerName || '—'}</td>
                    <td className="px-4 py-3 font-bold text-white">
                      ₹{parseFloat(pmt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(pmt.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-300">{pmt.paymentMethod}</td>
                    <td className="px-4 py-3 text-amber-400">
                      ₹{parseFloat(pmt.allocatedInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-emerald-400">
                      ₹{parseFloat(pmt.allocatedPrincipal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {parseFloat(pmt.unallocatedAmount) > 0 ? (
                        <span className="text-cyan-400 font-semibold">
                          ₹{parseFloat(pmt.unallocatedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        '₹0.00'
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(pmt.status)}`}>
                        {pmt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      <Link
                        to={`/payments/${pmt.id}`}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-3">
            <div className="text-4xl text-slate-600">💸</div>
            <h3 className="text-base font-semibold text-slate-300">No payment transactions found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {referenceNumber || paymentMethod || status || dateFrom || dateTo
                ? 'Try clearing active filters to see all payment records.'
                : 'No payments have been recorded yet. Click "Record Payment" to post a transaction.'}
            </p>
          </div>
        )}

        {/* Pagination Footer */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Showing page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} records)
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40 transition-colors"
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
