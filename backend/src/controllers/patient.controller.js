'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const patientService = require('../services/patient.service');
const appointmentService = require('../services/appointment.service');

const create = asyncHandler(async (req, res) => {
  const patient = await patientService.create(req.body);
  res.status(201).json({ success: true, data: patient });
});

const list = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const { data, meta } = await patientService.list({ search, page, limit });
  res.status(200).json({ success: true, data, meta });
});

const getById = asyncHandler(async (req, res) => {
  const patient = await patientService.findById(req.params.id);
  if (!patient) {
    throw AppError.notFound('Patient not found');
  }

  // Patient details page also needs the appointment history.
  const appointments = await appointmentService.listByPatient(patient.id);

  res.status(200).json({ success: true, data: { ...patient, appointments } });
});

const update = asyncHandler(async (req, res) => {
  const patient = await patientService.update(req.params.id, req.body);
  if (!patient) {
    throw AppError.notFound('Patient not found');
  }
  res.status(200).json({ success: true, data: patient });
});

const remove = asyncHandler(async (req, res) => {
  const deleted = await patientService.remove(req.params.id);
  if (!deleted) {
    throw AppError.notFound('Patient not found');
  }
  res.status(200).json({ success: true, data: { id: req.params.id } });
});

module.exports = { create, list, getById, update, remove };
