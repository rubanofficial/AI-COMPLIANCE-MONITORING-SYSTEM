/**
 * Dashboard Controller — equivalent to /dashboard/* endpoints.
 * Reads are served from PostgreSQL via the dashboard service.
 */
import {
  getDashboardStats,
  getRecentScans,
  getTrendData,
  getLatestScanData,
  getEvaluatedProducts,
} from '../services/dashboardService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getStats = asyncHandler(async (req, res) => {
  res.json(await getDashboardStats());
});

export const getRecent = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  res.json({ scans: await getRecentScans(limit) });
});

export const getTrends = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 7;
  res.json({ trends: await getTrendData(days) });
});

export const getLiveData = asyncHandler(async (req, res) => {
  res.json(await getLatestScanData());
});

export const getAllEvaluated = asyncHandler(async (req, res) => {
  res.json({ products: await getEvaluatedProducts() });
});

export default { getStats, getRecent, getTrends, getLiveData, getAllEvaluated };
