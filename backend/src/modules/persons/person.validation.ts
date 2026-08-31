import { z } from 'zod';
import { PersonType, PersonStatus, PersonIdType } from './person.types.js';

export const createPersonSchema = z.object({
  type: z.nativeEnum(PersonType).default(PersonType.INDIVIDUAL),
  firstName: z.string().trim().min(1, 'First name is required for individuals').optional(),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, 'Last name is required for individuals').optional(),
  organizationName: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().trim().min(5, 'Valid phone number is required'),
  alternatePhone: z.string().trim().optional(),
  idType: z.nativeEnum(PersonIdType).optional(),
  idNumber: z.string().trim().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    })
    .optional(),
  dateOfBirth: z.string().datetime().or(z.date()).optional(),
  occupation: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

export const updatePersonSchema = z.object({
  firstName: z.string().trim().optional(),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  organizationName: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  alternatePhone: z.string().trim().optional(),
  idType: z.nativeEnum(PersonIdType).optional(),
  idNumber: z.string().trim().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    })
    .optional(),
  dateOfBirth: z.string().datetime().or(z.date()).optional(),
  occupation: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

export const lookupOrCreatePersonSchema = z.object({
  phone: z.string().trim().min(5, 'Valid phone number is required'),
  firstName: z.string().trim().optional(),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  organizationName: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  idType: z.nativeEnum(PersonIdType).optional(),
  idNumber: z.string().trim().optional()
});

export const updatePersonStatusSchema = z.object({
  status: z.nativeEnum(PersonStatus)
});

export const queryPersonSchema = z.object({
  search: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  status: z.nativeEnum(PersonStatus).optional(),
  page: z.string().or(z.number()).optional(),
  limit: z.string().or(z.number()).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
