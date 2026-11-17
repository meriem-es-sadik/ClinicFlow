'use strict';

const { z, paginationSchema } = require('./common.validator');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fullName = z
  .string({ required_error: 'Full name is required' })
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(160, 'Full name must be at most 160 characters');

const cin = z
  .string({ required_error: 'CIN is required' })
  .trim()
  .min(3, 'CIN must be at least 3 characters')
  .max(20, 'CIN must be at most 20 characters')
  .regex(/^[A-Za-z0-9-]+$/, 'CIN may only contain letters, numbers and dashes')
  .transform((value) => value.toUpperCase());

const phone = z
  .string({ required_error: 'Phone is required' })
  .trim()
  .min(5, 'Phone must be at least 5 characters')
  .max(30, 'Phone must be at most 30 characters')
  .regex(/^[+]?[\d\s().-]+$/, 'Phone contains invalid characters');

const birthDate = z
  .string({ required_error: 'Birth date is required' })
  .regex(DATE_RE, 'Birth date must use the YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Birth date is not a valid date')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return date.getTime() <= Date.now();
  }, 'Birth date cannot be in the future');

const address = z
  .string()
  .trim()
  .max(255, 'Address must be at most 255 characters')
  .optional()
  .or(z.literal('').transform(() => undefined))
  .or(z.null().transform(() => undefined));

const createPatientSchema = z.object({
  fullName,
  cin,
  phone,
  birthDate,
  address,
});

// Every field optional, but at least one must be provided.
const updatePatientSchema = z
  .object({
    fullName: fullName.optional(),
    cin: cin.optional(),
    phone: phone.optional(),
    birthDate: birthDate.optional(),
    address,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

const listPatientsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(160).optional(),
});

module.exports = {
  createPatientSchema,
  updatePatientSchema,
  listPatientsQuerySchema,
};
