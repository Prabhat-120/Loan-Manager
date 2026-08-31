import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../../common/utils/phone.js';
import { BadRequestError } from '../../common/errors/app-error.js';

describe('Phone Normalization Utility (libphonenumber-js)', () => {
  it('should normalize 10-digit Indian phone number to E.164 canonical format', () => {
    const normalized = normalizePhone('9876543210', 'IN');
    expect(normalized).toBe('+919876543210');
  });

  it('should normalize formatted phone with spaces and country code', () => {
    const normalized = normalizePhone('+91 98765 43210', 'IN');
    expect(normalized).toBe('+919876543210');
  });

  it('should throw BadRequestError for invalid phone number strings', () => {
    expect(() => normalizePhone('12345')).toThrow(BadRequestError);
  });
});
