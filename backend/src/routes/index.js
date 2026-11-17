'use strict';

const express = require('express');
const authRoutes = require('./auth.routes');
const patientRoutes = require('./patient.routes');
const appointmentRoutes = require('./appointment.routes');
const dashboardRoutes = require('./dashboard.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
