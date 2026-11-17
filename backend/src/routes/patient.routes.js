'use strict';

const express = require('express');
const patientController = require('../controllers/patient.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  createPatientSchema,
  updatePatientSchema,
  listPatientsQuerySchema,
} = require('../validators/patient.validator');
const { idParamsSchema } = require('../validators/common.validator');

const router = express.Router();

// Every patient route requires an authenticated user.
router.use(authenticate);

router.post('/', validate(createPatientSchema), patientController.create);
router.get('/', validate(listPatientsQuerySchema, 'query'), patientController.list);
router.get('/:id', validate(idParamsSchema, 'params'), patientController.getById);
router.put(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updatePatientSchema),
  patientController.update,
);
// Admin-only deletion
router.delete(
  '/:id',
  authorize('admin'),
  validate(idParamsSchema, 'params'),
  patientController.remove,
);

module.exports = router;
