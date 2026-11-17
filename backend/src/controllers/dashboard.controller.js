'use strict';

const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

const getStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getStats();
  res.status(200).json({ success: true, data: stats });
});

const getUpcoming = asyncHandler(async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 5, 20);
  const upcoming = await dashboardService.getUpcoming(limit);
  res.status(200).json({ success: true, data: upcoming });
});

module.exports = { getStats, getUpcoming };
