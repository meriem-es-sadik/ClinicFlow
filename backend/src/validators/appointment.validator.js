'use strict';

const { z, uuidParam, paginationSchema } = require('./common.validator');

const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'cancelled'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const appointmentStatus = z.enum(APPOINTMENT_STATUSES, {
  errorMap: () => ({ message: `Status must be one of: ${APPOINTMENT_STATUSES.join(', ')}` }),
});

const appointmentDate = z
  .string({ required_error: 'Appointment date is required' })
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Appointment date is not a valid date')
  .transform((value) => new Date(value));

const createAppointmentSchema = z.object({
  patientId: uuidParam,
  appointmentDate,
  status: appointmentStatus.optional().default('pending'),
  reason: z
    .string({ required_error: 'Reason is required' })
    .trim()
    .min(2, 'Reason must be at least 2 characters')
    .max(255, 'Reason must be at most 255 characters'),
  notes: z
    .string()
    .trim()
    .max(2000, 'Notes must be at most 2000 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const updateStatusSchema = z.object({
  status: appointmentStatus,
});

const listAppointmentsQuerySchema = paginationSchema.extend({
  date: z
    .string()
    .regex(DATE_RE, 'Date filter must use the YYYY-MM-DD format')
    .optional(),
  status: appointmentStatus.optional(),
  patientId: uuidParam.optional(),
  search: z.string().trim().max(160, 'Search must be at most 160 characters').optional(),
});

module.exports = {
  APPOINTMENT_STATUSES,
  createAppointmentSchema,
  updateStatusSchema,
  listAppointmentsQuerySchema,
};
