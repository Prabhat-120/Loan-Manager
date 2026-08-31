import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loanApi, LoanSummary } from '../../api/loan-api';
import { paymentApi, PaymentMethodType, CreatePaymentInput } from '../../api/payment-api';

export const CreatePaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const initialLoanId = searchParams.get('loanId') || '';

  const [selectedLoanId, setSelectedLoanId] = useState(initialLoanId);
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch payable loans list (ACTIVE, PARTIALLY_PAID, OVERDUE)
  const { data: loansData, isLoading: isLoansLoading } = useQuery({
    queryKey: ['payableLoans'],
    queryFn: () => loanApi.listLoans({ limit: 100 })
  });

  const payableLoans = (loansData?.loans || []).filter(
    (l: LoanSummary) => l.status === 'ACTIVE' || l.status === 'PARTIALLY_PAID' || l.status === 'OVERDUE'
  );

  // Fetch selected loan detail
  const { data: selectedLoanDetail } = useQuery({
    queryKey: ['loanDetail', selectedLoanId],
    queryFn: () => loanApi.getLoanById(selectedLoanId),
    enabled: !!selectedLoanId
  });

  // Fetch live backend allocation preview
  const numAmount = parseFloat(amount);
  const isAmountValid = !isNaN(numAmount) && numAmount > 0;

  const { data: previewData, isFetching: isPreviewFetching } = useQuery({
    queryKey: ['paymentPreview', selectedLoanId, numAmount, paymentDate],
    queryFn: () =>
      paymentApi.previewPayment({
        loanId: selectedLoanId,
        amount: numAmount,
        paymentDate
      }),
    enabled: !!selectedLoanId && isAmountValid,
    staleTime: 1000
  });

  useEffect(() => {
    if (initialLoanId && !selectedLoanId) {
      setSelectedLoanId(initialLoanId);
    }
  }, [initialLoanId, selectedLoanId]);

  const createPaymentMutation = useMutation({
    mutationFn: (input: CreatePaymentInput) => {
      // Generate a unique idempotency key per submit attempt
      const idempotencyKey = `pmt-${selectedLoanId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      return paymentApi.createPayment(input, idempotencyKey);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['loanDetail', selectedLoanId] });
      queryClient.invalidateQueries({ queryKey: ['loanPayments', selectedLoanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      navigate(`/payments/${res.data.id}`);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.error?.message || err.message || 'Failed to record payment');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) {
      setFormError('Please select a loan to record payment against.');
      return;
    }
    if (!isAmountValid) {
      setFormError('Please enter a valid positive payment amount.');
      return;
    }
    setFormError(null);

    createPaymentMutation.mutate({
      loanId: selectedLoanId,
      amount: numAmount,
      paymentDate,
      paymentMethod,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Link to="/payments" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
          ← Back to Payments Ledger
        </Link>
        <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
          <span>💵</span> Record Loan Payment
        </h1>
        <p className="text-sm text-slate-400">
          Post actual money received and automatically allocate across scheduled obligations
        </p>
      </div>

      {formError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl text-sm">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Loan */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h2 className="text-base font-bold text-white border-b border-slate-800 pb-2">
            1. Target Loan Selection
          </h2>

          <div>
            <label htmlFor="loan-select" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Active / Payable Loan <span className="text-rose-400">*</span>
            </label>
            {isLoansLoading ? (
              <div className="text-xs text-slate-500">Loading active loans...</div>
            ) : (
              <select
                id="loan-select"
                aria-label="Select Active / Payable Loan"
                required
                value={selectedLoanId}
                onChange={(e) => {
                  setSelectedLoanId(e.target.value);
                  setFormError(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Choose a Loan --</option>
                {payableLoans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.loanNumber} — {l.borrower?.displayName || 'Borrower'} (Outstanding: ₹
                    {parseFloat(l.outstandingTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Loan Overview Card */}
          {selectedLoanDetail && (
            <div className="mt-4 p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {selectedLoanDetail.loan.loanNumber} ({selectedLoanDetail.loan.loanType})
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  {selectedLoanDetail.loan.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Borrower:</span>
                  <span className="font-semibold text-white">{selectedLoanDetail.borrower.displayName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Outstanding Principal:</span>
                  <span className="font-mono font-bold text-white">
                    ₹{parseFloat(selectedLoanDetail.financialSummary.outstandingPrincipal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Outstanding Interest:</span>
                  <span className="font-mono font-bold text-amber-400">
                    ₹{parseFloat(selectedLoanDetail.financialSummary.outstandingInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Outstanding:</span>
                  <span className="font-mono font-bold text-rose-400">
                    ₹{parseFloat(selectedLoanDetail.financialSummary.outstandingTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Payment Parameters */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h2 className="text-base font-bold text-white border-b border-slate-800 pb-2">
            2. Payment Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Amount (₹) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 5000.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Method <span className="text-rose-400">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT / IMPS</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Reference / Transaction # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. UPI/2026/02/987654321"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="Add any internal transaction remarks or ledger comments..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Step 3: Authoritative Backend Allocation Preview */}
        {selectedLoanId && isAmountValid && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚡</span> Authoritative Allocation Preview
              </h2>
              {isPreviewFetching && (
                <span className="text-xs text-indigo-400 animate-pulse">Calculating engine preview...</span>
              )}
            </div>

            {previewData && (
              <div className="space-y-4">
                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                    <span className="text-xs text-slate-500 uppercase font-semibold block">Total Payment</span>
                    <span className="text-lg font-bold font-mono text-white mt-1 block">
                      ₹{parseFloat(previewData.paymentAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                    <span className="text-xs text-slate-500 uppercase font-semibold block">Interest Allocation</span>
                    <span className="text-lg font-bold font-mono text-amber-400 mt-1 block">
                      ₹{parseFloat(previewData.allocatedInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                    <span className="text-xs text-slate-500 uppercase font-semibold block">Principal Allocation</span>
                    <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                      ₹{parseFloat(previewData.allocatedPrincipal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                    <span className="text-xs text-slate-500 uppercase font-semibold block">Unallocated Excess</span>
                    <span className={`text-lg font-bold font-mono mt-1 block ${parseFloat(previewData.unallocatedAmount) > 0 ? 'text-cyan-400' : 'text-slate-400'}`}>
                      ₹{parseFloat(previewData.unallocatedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {parseFloat(previewData.unallocatedAmount) > 0 && (
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs">
                    ℹ <strong>Overpayment Detected:</strong> The payment exceeds remaining scheduled balance by ₹
                    {parseFloat(previewData.unallocatedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}. This amount will be safely isolated as unallocated funds.
                  </div>
                )}

                {/* Per Schedule Installment Preview Table */}
                {previewData.scheduleAllocations.length > 0 && (
                  <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2">Inst #</th>
                          <th className="px-3 py-2">Due Date</th>
                          <th className="px-3 py-2">Scheduled</th>
                          <th className="px-3 py-2">Alloc Interest</th>
                          <th className="px-3 py-2">Alloc Principal</th>
                          <th className="px-3 py-2">Total Paid</th>
                          <th className="px-3 py-2">Remaining</th>
                          <th className="px-3 py-2">Result Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {previewData.scheduleAllocations.map((item) => (
                          <tr key={item.installmentNumber} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-semibold text-white">{item.installmentNumber}</td>
                            <td className="px-3 py-2 text-slate-400">{new Date(item.dueDate).toLocaleDateString()}</td>
                            <td className="px-3 py-2">₹{item.scheduledAmount}</td>
                            <td className="px-3 py-2 text-amber-400 font-medium">₹{item.allocatedInterest}</td>
                            <td className="px-3 py-2 text-emerald-400 font-medium">₹{item.allocatedPrincipal}</td>
                            <td className="px-3 py-2 font-bold text-white">₹{item.allocatedTotal}</td>
                            <td className="px-3 py-2 text-slate-300">₹{item.remainingAfterPayment}</td>
                            <td className="px-3 py-2 font-sans">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                {item.statusAfterPayment}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            to="/payments"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createPaymentMutation.isPending || !selectedLoanId || !isAmountValid}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {createPaymentMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                <span>Posting Payment...</span>
              </>
            ) : (
              'Confirm & Post Payment'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
