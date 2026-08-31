import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import Decimal from 'decimal.js';
import {
  toDecimal,
  toDecimal128,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  formatMoneyPresentation
} from '../../common/utils/money.js';

describe('Exact Money Utility (Decimal128 & decimal.js)', () => {
  it('should convert number, string, and Decimal128 to Decimal without float errors', () => {
    const d1 = toDecimal('100.50');
    const d2 = toDecimal(50.25);
    const d3128 = Types.Decimal128.fromString('75.10');
    const d3 = toDecimal(d3128);

    expect(d1).toBeInstanceOf(Decimal);
    expect(d1.toFixed(2)).toBe('100.50');
    expect(d2.toFixed(2)).toBe('50.25');
    expect(d3.toFixed(2)).toBe('75.10');
  });

  it('should perform exact addition without binary floating point errors (e.g. 0.1 + 0.2 === 0.3)', () => {
    const sum = addMoney('0.1', '0.2');
    expect(sum.toString()).toBe('0.3');
  });

  it('should perform exact subtraction, multiplication, and division', () => {
    const sub = subtractMoney('100.00', '25.50');
    expect(sub.toString()).toBe('74.5');

    const mul = multiplyMoney('10.50', '3');
    expect(mul.toString()).toBe('31.5');

    const div = divideMoney('100', '4');
    expect(div.toString()).toBe('25');
  });

  it('should convert to Types.Decimal128 safely', () => {
    const dec128 = toDecimal128('1234.5678');
    expect(dec128).toBeInstanceOf(Types.Decimal128);
    expect(dec128.toString()).toBe('1234.5678');
  });

  it('should format presentation currency for INR', () => {
    const formatted = formatMoneyPresentation('50000', 'INR');
    expect(formatted).toContain('50,000');
  });
});
