import { Types } from 'mongoose';
import Decimal from 'decimal.js';

export type MoneyInput = Types.Decimal128 | Decimal | number | string;

export const toDecimal = (val: MoneyInput): Decimal => {
  if (val instanceof Decimal) {
    return val;
  }
  if (val instanceof Types.Decimal128) {
    return new Decimal(val.toString());
  }
  return new Decimal(val);
};

export const toDecimal128 = (val: MoneyInput): Types.Decimal128 => {
  if (val instanceof Types.Decimal128) {
    return val;
  }
  const decimalVal = toDecimal(val);
  return Types.Decimal128.fromString(decimalVal.toFixed(4));
};

export const addMoney = (a: MoneyInput, b: MoneyInput): Decimal => {
  return toDecimal(a).plus(toDecimal(b));
};

export const subtractMoney = (a: MoneyInput, b: MoneyInput): Decimal => {
  return toDecimal(a).minus(toDecimal(b));
};

export const multiplyMoney = (a: MoneyInput, b: MoneyInput): Decimal => {
  return toDecimal(a).times(toDecimal(b));
};

export const divideMoney = (a: MoneyInput, b: MoneyInput): Decimal => {
  return toDecimal(a).div(toDecimal(b));
};

export const formatMoneyPresentation = (val: MoneyInput, currency = 'INR'): string => {
  const num = toDecimal(val).toNumber();
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency
  }).format(num);
};
