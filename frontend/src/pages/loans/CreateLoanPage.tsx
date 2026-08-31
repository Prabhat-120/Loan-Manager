import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { personApi } from '../../api/person-api';
import { loanApi, CreateLoanPayload, SchedulePreviewResult } from '../../api/loan-api';

export const CreateLoanPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  // Form states
  const [lenderPersonId, setLenderPersonId] = useState('');
  const [borrowerPersonId, setBorrowerPersonId] = useState('');
  const [loanType, setLoanType] = useState<'INTEREST_ONLY' | 'EMI' | 'FULL_PAYMENT'>('EMI');
  const [principalAmount, setPrincipalAmount] = useState('100000');
  const [interestRate, setInterestRate] = useState('12');
  const [interestCalculationMethod, setInterestCalculationMethod] = useState<'FLAT' | 'REDUCING_BALANCE'>('REDUCING_BALANCE');
  const [termMonths, setTermMonths] = useState(12);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [firstDueDate, setFirstDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [paymentFrequency, setPaymentFrequency] = useState<'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'>('MONTHLY');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Schedule preview cache
  const [previewData, setPreviewData] = useState<SchedulePreviewResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Fetch people list for lender and borrower selection
  const { data: peopleData, isLoading: isPeopleLoading } = useQuery({
    queryKey: ['activePersonsForLoan'],
    queryFn: () => personApi.listPersons({ status: 'ACTIVE', limit: 100 })
  });

  const activePeople = peopleData?.persons || [];
  const selectedLender = activePeople.find((p) => p.id === lenderPersonId);
  const selectedBorrower = activePeople.find((p) => p.id === borrowerPersonId);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (payload: CreateLoanPayload) => loanApi.createLoan(payload),
    onSuccess: (res) => {
      navigate(`/loans/${res.loan.id}`);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to create loan');
    }
  });

  // Handle preview fetch when moving to step 6
  const fetchPreview = async () => {
    setIsPreviewLoading(true);
    setError(null);
    try {
      const res = await loanApi.previewSchedule({
        loanType,
        principalAmount: Number(principalAmount),
        annualInterestRate: Number(interestRate),
        interestCalculationMethod,
        termMonths: Number(termMonths),
        startDate,
        firstDueDate,
        paymentFrequency
      });
      setPreviewData(res);
      setCurrentStep(6);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to calculate schedule preview');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleNextStep = () => {
    setError(null);

    if (currentStep === 1) {
      if (!lenderPersonId) {
        setError('Please select a Lender.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!borrowerPersonId) {
        setError('Please select a Borrower.');
        return;
      }
      if (lenderPersonId === borrowerPersonId) {
        setError('Lender and Borrower cannot be the same Person.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      const p = Number(principalAmount);
      const t = Number(termMonths);
      if (isNaN(p) || p <= 0) {
        setError('Principal amount must be a positive number.');
        return;
      }
      if (isNaN(t) || t < 1) {
        setError('Term must be at least 1 month.');
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      const r = Number(interestRate);
      if (isNaN(r) || r < 0) {
        setError('Interest rate must be 0 or a positive number.');
        return;
      }
      if (loanType === 'EMI' && interestCalculationMethod !== 'REDUCING_BALANCE') {
        setError('Reducing balance method is required for EMI loans.');
        return;
      }
      setCurrentStep(5);
    } else if (currentStep === 5) {
      if (new Date(firstDueDate) < new Date(startDate)) {
        setError('First due date cannot be before loan start date.');
        return;
      }
      fetchPreview();
    } else if (currentStep === 6) {
      setCurrentStep(7);
    }
  };

  const handleSubmitLoan = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate({
      lenderPersonId,
      borrowerPersonId,
      loanType,
      principalAmount: Number(principalAmount),
      interestRate: Number(interestRate),
      interestCalculationMethod,
      termMonths: Number(termMonths),
      startDate,
      firstDueDate,
      paymentFrequency,
      notes: notes || undefined
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/loans" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
            ← Back to Loans
          </Link>
          <h1 className="text-2xl font-bold text-white mt-1">Create New Loan</h1>
          <p className="text-sm text-slate-400">Configure loan terms, participants, and repayment schedule</p>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex justify-between items-center overflow-x-auto text-xs">
        {[
          { step: 1, label: 'Lender' },
          { step: 2, label: 'Borrower' },
          { step: 3, label: 'Terms' },
          { step: 4, label: 'Interest' },
          { step: 5, label: 'Schedule' },
          { step: 6, label: 'Preview' },
          { step: 7, label: 'Confirm' }
        ].map((s) => (
          <div
            key={s.step}
            className={`flex items-center space-x-2 px-2 py-1 rounded-lg ${
              currentStep === s.step
                ? 'bg-indigo-600/20 text-indigo-400 font-semibold border border-indigo-500/30'
                : currentStep > s.step
                ? 'text-emerald-400'
                : 'text-slate-500'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                currentStep === s.step
                  ? 'bg-indigo-600 text-white'
                  : currentStep > s.step
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {currentStep > s.step ? '✓' : s.step}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Main Wizard Form Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Step 1: Select Lender */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Step 1: Select Lender</h2>
            <p className="text-sm text-slate-400">Choose the person or organization funding this loan.</p>

            {isPeopleLoading ? (
              <div className="py-8 text-center text-slate-400">Loading people directory...</div>
            ) : activePeople.length === 0 ? (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-sm">
                No active people found in tenant.{' '}
                <Link to="/persons" className="text-indigo-400 underline">
                  Add people first
                </Link>
                .
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {activePeople.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => setLenderPersonId(person.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      lenderPersonId === person.id
                        ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-white">{person.displayName}</div>
                      <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
                        {person.type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-mono">{person.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Borrower */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Step 2: Select Borrower</h2>
            <p className="text-sm text-slate-400">Choose the person or organization receiving this loan.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {activePeople.map((person) => {
                const isLender = person.id === lenderPersonId;
                return (
                  <div
                    key={person.id}
                    onClick={() => {
                      if (!isLender) setBorrowerPersonId(person.id);
                    }}
                    className={`p-4 rounded-xl border transition-all ${
                      isLender
                        ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800'
                        : borrowerPersonId === person.id
                        ? 'bg-indigo-600/10 border-indigo-500 cursor-pointer shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 cursor-pointer'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-white">{person.displayName}</div>
                      <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
                        {isLender ? 'Selected as Lender' : person.type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-mono">{person.phone}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Loan Terms */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Step 3: Loan Terms</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Loan Type</label>
                <select
                  value={loanType}
                  onChange={(e) => {
                    const nextType = e.target.value as any;
                    setLoanType(nextType);
                    if (nextType === 'EMI') {
                      setInterestCalculationMethod('REDUCING_BALANCE');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="EMI">EMI (Reducing Balance)</option>
                  <option value="INTEREST_ONLY">Interest Only (Monthly Interest + Bullet Principal)</option>
                  <option value="FULL_PAYMENT">Full Payment (Principal + Interest at Maturity)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Principal Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="100000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Term (Months)</label>
                <input
                  type="number"
                  min="1"
                  max="360"
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Interest Configuration */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Step 4: Interest Configuration</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Annual Interest Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="12"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Interest Calculation Method</label>
                <select
                  value={interestCalculationMethod}
                  disabled={loanType === 'EMI'}
                  onChange={(e) => setInterestCalculationMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                >
                  <option value="REDUCING_BALANCE">Reducing Balance</option>
                  <option value="FLAT">Flat Rate</option>
                </select>
                {loanType === 'EMI' && (
                  <p className="text-xs text-slate-500 mt-1">Reducing balance is required for EMI loans.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Repayment Configuration */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Step 5: Repayment Schedule Configuration</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Frequency</label>
                <select
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUALLY">Annually</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Loan Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">First Due Date</label>
                <input
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Notes (Optional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 placeholder-slate-600"
                placeholder="Add any internal comments or conditions..."
              />
            </div>
          </div>
        )}

        {/* Step 6: Schedule Preview */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Step 6: Schedule Preview</h2>

            {isPreviewLoading ? (
              <div className="py-8 text-center text-slate-400">Generating preview calculation...</div>
            ) : previewData ? (
              <div className="space-y-4">
                {/* Financial Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Principal</span>
                    <div className="text-base font-bold font-mono text-white mt-0.5">
                      ₹{parseFloat(previewData.principalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Total Interest</span>
                    <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                      ₹{parseFloat(previewData.totalInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Total Payable</span>
                    <div className="text-base font-bold font-mono text-indigo-400 mt-0.5">
                      ₹{parseFloat(previewData.totalPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  {previewData.monthlyEMI && (
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <span className="text-xs text-slate-400 uppercase font-semibold">Installment EMI</span>
                      <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                        ₹{parseFloat(previewData.monthlyEMI).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Schedule Table Preview */}
                <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="sticky top-0 uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Due Date</th>
                        <th className="px-3 py-2">Opening</th>
                        <th className="px-3 py-2">Principal</th>
                        <th className="px-3 py-2">Interest</th>
                        <th className="px-3 py-2">Total Installment</th>
                        <th className="px-3 py-2">Closing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {previewData.schedule.map((item) => (
                        <tr key={item.installmentNumber} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-semibold text-slate-200">{item.installmentNumber}</td>
                          <td className="px-3 py-2 text-slate-400">
                            {new Date(item.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">₹{item.openingPrincipal}</td>
                          <td className="px-3 py-2 text-emerald-400">₹{item.scheduledPrincipal}</td>
                          <td className="px-3 py-2 text-amber-400">₹{item.scheduledInterest}</td>
                          <td className="px-3 py-2 font-bold text-white">₹{item.scheduledAmount}</td>
                          <td className="px-3 py-2 text-slate-400">₹{item.closingPrincipal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Step 7: Confirm & Create */}
        {currentStep === 7 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Step 7: Confirm Loan Creation</h2>
            <p className="text-sm text-slate-400">Review all details before saving as DRAFT.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">Lender</span>
                <div className="font-semibold text-white mt-0.5">{selectedLender?.displayName}</div>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">Borrower</span>
                <div className="font-semibold text-white mt-0.5">{selectedBorrower?.displayName}</div>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">Loan Type</span>
                <div className="font-semibold text-white mt-0.5">{loanType}</div>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">Principal</span>
                <div className="font-semibold font-mono text-white mt-0.5">₹{principalAmount}</div>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">Interest Rate</span>
                <div className="font-semibold font-mono text-white mt-0.5">{interestRate}% p.a.</div>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">Term</span>
                <div className="font-semibold text-white mt-0.5">{termMonths} Months</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-800">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((s) => s - 1)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          {currentStep < 7 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/20"
            >
              {currentStep === 5 ? 'Calculate Preview →' : 'Continue →'}
            </button>
          ) : (
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={handleSubmitLoan}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating Loan...' : 'Confirm & Create Loan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
