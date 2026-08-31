import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentApi, PaymentSummary } from '../../api/payment-api';

interface ReversePaymentModalProps {
  payment: PaymentSummary;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReversePaymentModal: React.FC<ReversePaymentModalProps> = ({
  payment,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const reverseMutation = useMutation({
    mutationFn: (reversalReason: string) => paymentApi.reversePayment(payment.id, reversalReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentDetail', payment.id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['loanDetail', payment.loanId] });
      queryClient.invalidateQueries({ queryKey: ['loanPayments', payment.loanId] });
      queryClient.invalidateQueries({ queryKey: ['loanSchedule', payment.loanId] });
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to reverse payment');
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      setError('Please provide a reason with at least 3 characters.');
      return;
    }
    setError(null);
    reverseMutation.mutate(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-rose-500">⚠</span> Reverse Payment
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">{payment.paymentNumber}</p>
          </div>
          <button
            onClick={onClose}
            disabled={reverseMutation.isPending}
            className="text-slate-400 hover:text-white text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Financial Warning */}
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 space-y-1">
          <p className="font-semibold">Important Financial Warning:</p>
          <p>
            This action changes the loan's financial balance. Allocated interest (₹{payment.allocatedInterest}) and principal (₹{payment.allocatedPrincipal}) will be restored to the loan's outstanding obligations.
          </p>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Payment Amount:</span>
            <span className="font-mono font-bold text-white">₹{parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Payment Date:</span>
            <span className="font-mono text-slate-200">{new Date(payment.paymentDate).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Payment Method:</span>
            <span className="text-slate-200">{payment.paymentMethod}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Reversal Reason <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the justification for reversing this posted transaction (e.g. Duplicate teller entry, bank bounce)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={reverseMutation.isPending}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reverseMutation.isPending || !reason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {reverseMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  <span>Reversing...</span>
                </>
              ) : (
                'Confirm Reversal'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
