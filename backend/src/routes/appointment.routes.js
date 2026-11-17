'use strict';

const express = require('express');
const appointmentController = require('../controllers/appointment.controller');
const authenticate = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createAppointmentSchema,
  updateStatusSchema,
  listAppointmentsQuerySchema,
} = require('../validators/appointment.validator');
const { idParamsSchema } = require('../validators/common.validator');

const router = express.Router();

router.use(authenticate);

router.post('/', validate(createAppointmentSchema), appointmentController.create);
router.get('/counts', appointmentController.counts);
router.get('/', validate(listAppointmentsQuerySchema, 'query'), appointmentController.list);
router.patch(
  '/:id/status',
  validate(idParamsSchema, 'params'),
  validate(updateStatusSchema),
  appointmentController.updateStatus,
);

module.exports = router;
