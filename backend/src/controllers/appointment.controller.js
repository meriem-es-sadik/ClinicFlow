'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const appointmentService = require('../services/appointment.service');

const create = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.create(req.body, req.user.id);
  res.status(201).json({ success: true, data: appointment });
});

const list = asyncHandler(async (req, res) => {
  const { date, status, patientId, search, page, limit } = req.query;
  const { data, meta } = await appointmentService.list({
    date,
    status,
    patientId,
    search,
    page,
    limit,
  });
  res.status(200).json({ success: true, data, meta });
});

const counts = asyncHandler(async (req, res) => {
  const data = await appointmentService.counts();
  res.status(200).json({ success: true, data });
});

const updateStatus = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.updateStatus(req.params.id, req.body.status);
  if (!appointment) {
    throw AppError.notFound('Appointment not found');
  }
  res.status(200).json({ success: true, data: appointment });
});

module.exports = { create, list, counts, updateStatus };
