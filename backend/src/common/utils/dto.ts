/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UserDTO {
  id: string;
  tenantId?: string;
  personId?: string;
  email: string;
  role: string;
  status: string;
  firstLogin: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TenantDTO {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: string;
  currency: string;
  timezone: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: Record<string, string>;
  country?: string;
  settings?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionDTO {
  id: string;
  tenantId: string;
  plan: string;
  status: string;
  billingCycle: string;
  amount: number;
  currency: string;
  startDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  limits: {
    maxUsers: number;
    maxActiveLoans: number;
    maxPeople: number;
  };
  createdAt?: Date;
}

export interface PersonDTO {
  id: string;
  tenantId: string;
  userId?: string;
  type: string;
  displayName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  organizationName?: string;
  email?: string;
  phone: string;
  normalizedPhone: string;
  alternatePhone?: string;
  idType?: string;
  idNumber?: string;
  address?: Record<string, string>;
  dateOfBirth?: Date;
  occupation?: string;
  notes?: string;
  status: string;
  hasUserAccount: boolean;
  linkedUserEmail?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const formatUserDTO = (user: any): UserDTO => {
  return {
    id: user._id ? user._id.toString() : user.id,
    tenantId: user.tenantId ? user.tenantId.toString() : undefined,
    personId: user.personId ? user.personId.toString() : undefined,
    email: user.email,
    role: user.role,
    status: user.status,
    firstLogin: !!user.firstLogin,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

export const formatTenantDTO = (tenant: any): TenantDTO => {
  return {
    id: tenant._id ? tenant._id.toString() : tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    domain: tenant.domain,
    status: tenant.status,
    currency: tenant.currency,
    timezone: tenant.timezone,
    contactEmail: tenant.contactEmail,
    contactPhone: tenant.contactPhone,
    address: tenant.address,
    country: tenant.country,
    settings: tenant.settings,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt
  };
};

export const formatSubscriptionDTO = (sub: any): SubscriptionDTO => {
  return {
    id: sub._id ? sub._id.toString() : sub.id,
    tenantId: sub.tenantId ? sub.tenantId.toString() : sub.tenantId,
    plan: sub.plan,
    status: sub.status,
    billingCycle: sub.billingCycle || 'MONTHLY',
    amount: sub.amount || 0,
    currency: sub.currency || 'INR',
    startDate: sub.startDate || sub.currentPeriodStart,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
    limits: sub.limits || { maxUsers: 5, maxActiveLoans: 50, maxPeople: 200 },
    createdAt: sub.createdAt
  };
};

export const formatPersonDTO = (person: any, linkedUserEmail?: string): PersonDTO => {
  return {
    id: person._id ? person._id.toString() : person.id,
    tenantId: person.tenantId ? person.tenantId.toString() : person.tenantId,
    userId: person.userId ? person.userId.toString() : undefined,
    type: person.type || 'INDIVIDUAL',
    displayName: person.displayName,
    firstName: person.firstName,
    middleName: person.middleName,
    lastName: person.lastName,
    organizationName: person.organizationName,
    email: person.email,
    phone: person.phone,
    normalizedPhone: person.normalizedPhone,
    alternatePhone: person.alternatePhone,
    idType: person.idType,
    idNumber: person.idNumber,
    address: person.address,
    dateOfBirth: person.dateOfBirth,
    occupation: person.occupation,
    notes: person.notes,
    status: person.status || 'ACTIVE',
    hasUserAccount: !!(person.userId || person.linkedUserEmail || linkedUserEmail),
    linkedUserEmail: linkedUserEmail || person.linkedUserEmail,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt
  };
};

export interface RepaymentScheduleDTO {
  id: string;
  tenantId: string;
  loanId: string;
  installmentNumber: number;
  dueDate: Date;
  openingPrincipal: string;
  scheduledPrincipal: string;
  scheduledInterest: string;
  scheduledAmount: string;
  paidPrincipal: string;
  paidInterest: string;
  paidAmount: string;
  remainingAmount: string;
  status: string;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LoanDTO {
  id: string;
  tenantId: string;
  loanNumber: string;
  lenderPersonId: string;
  borrowerPersonId: string;
  loanType: string;
  principalAmount: string;
  interestRate: string;
  interestRateType: string;
  interestCalculationMethod: string;
  termMonths: number;
  startDate: Date;
  firstDueDate: Date;
  maturityDate?: Date;
  paymentFrequency: string;
  status: string;
  totalInterest: string;
  totalPayable: string;
  totalPaid: string;
  outstandingPrincipal: string;
  outstandingInterest: string;
  outstandingTotal: string;
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  lender?: PersonDTO;
  borrower?: PersonDTO;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LoanFinancialSummaryDTO {
  principal: string;
  interestRate: string;
  totalInterest: string;
  totalPayable: string;
  totalPaid: string;
  outstandingPrincipal: string;
  outstandingInterest: string;
  outstandingTotal: string;
}

export interface LoanDetailDTO {
  loan: LoanDTO;
  lender: PersonDTO;
  borrower: PersonDTO;
  financialSummary: LoanFinancialSummaryDTO;
  scheduleSummary: {
    totalInstallments: number;
    pendingInstallments: number;
    paidInstallments: number;
    overdueInstallments: number;
  };
}

const to2Dec = (val: any): string => {
  if (val === undefined || val === null) return '0.00';
  const num = parseFloat(val.toString());
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

export const formatRepaymentScheduleDTO = (item: any): RepaymentScheduleDTO => {
  return {
    id: item._id ? item._id.toString() : item.id,
    tenantId: item.tenantId ? item.tenantId.toString() : item.tenantId,
    loanId: item.loanId ? item.loanId.toString() : item.loanId,
    installmentNumber: item.installmentNumber,
    dueDate: item.dueDate,
    openingPrincipal: to2Dec(item.openingPrincipal),
    scheduledPrincipal: to2Dec(item.scheduledPrincipal),
    scheduledInterest: to2Dec(item.scheduledInterest),
    scheduledAmount: to2Dec(item.scheduledAmount),
    paidPrincipal: to2Dec(item.paidPrincipal),
    paidInterest: to2Dec(item.paidInterest),
    paidAmount: to2Dec(item.paidAmount),
    remainingAmount: to2Dec(item.remainingAmount),
    status: item.status,
    paidAt: item.paidAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
};

export const formatLoanDTO = (loan: any, lender?: any, borrower?: any): LoanDTO => {
  const principalAmount = to2Dec(loan.principalAmount);
  const interestRate = to2Dec(loan.interestRate);
  const totalInterest = to2Dec(loan.totalInterest);
  const totalPayable = to2Dec(loan.totalPayable);
  const totalPaid = to2Dec(loan.totalPaid);
  const outstandingPrincipal = to2Dec(loan.outstandingPrincipal);
  const outstandingInterest = to2Dec(loan.outstandingInterest);
  const outstandingTotal = (parseFloat(outstandingPrincipal) + parseFloat(outstandingInterest)).toFixed(2);

  return {
    id: loan._id ? loan._id.toString() : loan.id,
    tenantId: loan.tenantId ? loan.tenantId.toString() : loan.tenantId,
    loanNumber: loan.loanNumber,
    lenderPersonId: loan.lenderPersonId ? (loan.lenderPersonId._id ? loan.lenderPersonId._id.toString() : loan.lenderPersonId.toString()) : '',
    borrowerPersonId: loan.borrowerPersonId ? (loan.borrowerPersonId._id ? loan.borrowerPersonId._id.toString() : loan.borrowerPersonId.toString()) : '',
    loanType: loan.loanType,
    principalAmount,
    interestRate,
    interestRateType: loan.interestRateType || 'PERCENTAGE_PER_YEAR',
    interestCalculationMethod: loan.interestCalculationMethod,
    termMonths: loan.termMonths,
    startDate: loan.startDate,
    firstDueDate: loan.firstDueDate,
    maturityDate: loan.maturityDate,
    paymentFrequency: loan.paymentFrequency,
    status: loan.status,
    totalInterest,
    totalPayable,
    totalPaid,
    outstandingPrincipal,
    outstandingInterest,
    outstandingTotal,
    notes: loan.notes,
    createdBy: loan.createdBy ? loan.createdBy.toString() : '',
    updatedBy: loan.updatedBy ? loan.updatedBy.toString() : undefined,
    lender: lender ? formatPersonDTO(lender) : undefined,
    borrower: borrower ? formatPersonDTO(borrower) : undefined,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt
  };
};

export const formatLoanDetailDTO = (
  loan: any,
  lender: any,
  borrower: any,
  scheduleStats?: { total: number; pending: number; paid: number; overdue: number }
): LoanDetailDTO => {
  const loanDTO = formatLoanDTO(loan, lender, borrower);
  return {
    loan: loanDTO,
    lender: formatPersonDTO(lender),
    borrower: formatPersonDTO(borrower),
    financialSummary: {
      principal: loanDTO.principalAmount,
      interestRate: loanDTO.interestRate,
      totalInterest: loanDTO.totalInterest,
      totalPayable: loanDTO.totalPayable,
      totalPaid: loanDTO.totalPaid,
      outstandingPrincipal: loanDTO.outstandingPrincipal,
      outstandingInterest: loanDTO.outstandingInterest,
      outstandingTotal: loanDTO.outstandingTotal
    },
    scheduleSummary: {
      totalInstallments: scheduleStats?.total || 0,
      pendingInstallments: scheduleStats?.pending || 0,
      paidInstallments: scheduleStats?.paid || 0,
      overdueInstallments: scheduleStats?.overdue || 0
    }
  };
};

