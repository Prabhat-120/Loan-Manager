import parsePhoneNumberFromString, { CountryCode } from 'libphonenumber-js';
import { BadRequestError } from '../errors/app-error.js';

export const normalizePhone = (rawPhone: string, defaultCountry: CountryCode = 'IN'): string => {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new BadRequestError('Phone number is required');
  }

  const trimmed = rawPhone.trim();
  const phoneNumber = parsePhoneNumberFromString(trimmed, defaultCountry);

  if (!phoneNumber || !phoneNumber.isValid()) {
    throw new BadRequestError(`Invalid phone number: ${rawPhone}`);
  }

  return phoneNumber.format('E.164');
};
