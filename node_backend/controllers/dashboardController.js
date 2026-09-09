/**
 * Dashboard Controller — equivalent to /dashboard/* endpoints.
 */
const {
  getDashboardStats,
  getRecentScans,
  getTrendData,
  getLatestScanData,
  getEvaluatedProducts,
} = require('../services/dashboardService');

function getStats(req, res) {
  res.json(getDashboardStats());
}

function getRecent(req, res) {
  const limit = parseInt(req.query.limit, 10) || 10;
  res.json({ scans: getRecentScans(limit) });
}

function getTrends(req, res) {
  const days = parseInt(req.query.days, 10) || 7;
  res.json({ trends: getTrendData(days) });
}

function getLiveData(req, res) {
  res.json(getLatestScanData());
}

function getAllEvaluated(req, res) {
  res.json({ products: getEvaluatedProducts() });
}

module.exports = { getStats, getRecent, getTrends, getLiveData, getAllEvaluated };
