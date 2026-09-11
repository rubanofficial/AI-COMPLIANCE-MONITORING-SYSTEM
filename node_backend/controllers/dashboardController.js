/**
 * Dashboard Controller — equivalent to /dashboard/* endpoints.
 * Reads are served from PostgreSQL via the dashboard service.
 */
const {
  getDashboardStats,
  getRecentScans,
  getTrendData,
  getLatestScanData,
  getEvaluatedProducts,
} = require('../services/dashboardService');
const { asyncHandler } = require('../utils/asyncHandler');

const getStats = asyncHandler(async (req, res) => {
  res.json(await getDashboardStats());
});

const getRecent = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  res.json({ scans: await getRecentScans(limit) });
});

const getTrends = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 7;
  res.json({ trends: await getTrendData(days) });
});

const getLiveData = asyncHandler(async (req, res) => {
  res.json(await getLatestScanData());
});

const getAllEvaluated = asyncHandler(async (req, res) => {
  res.json({ products: await getEvaluatedProducts() });
});

module.exports = { getStats, getRecent, getTrends, getLiveData, getAllEvaluated };
