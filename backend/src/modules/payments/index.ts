import { ModuleMetadata } from '../types.js';

export const paymentsModuleMetadata: ModuleMetadata = {
  name: 'payments',
  description: 'Payment Transactions and Ledger Module',
  version: '1.0.0',
  status: 'active'
};

export * from './payment.types.js';
export * from './payment.model.js';
export * from './payment-counter.model.js';
export * from './payment-schedule-allocation.types.js';
export * from './payment-schedule-allocation.model.js';
export * from './idempotency.types.js';
export * from './idempotency.model.js';
export * from './payment-allocation.service.js';
export * from './overdue.service.js';
export * from './reconciliation.service.js';
export * from './payment.service.js';
export * from './payment.controller.js';
export * from './payment.routes.js';
export * from './payment.validation.js';
