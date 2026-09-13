/**
 * Dashboard Routes — /dashboard endpoints.
 */
import express from 'express';
import {
  getStats,
  getRecent,
  getTrends,
  getLiveData,
  getAllEvaluated,
} from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/dashboard/stats', getStats);
router.get('/dashboard/recent-scans', getRecent);
router.get('/dashboard/trends', getTrends);
router.get('/dashboard/live-data', getLiveData);
router.get('/dashboard/evaluated-products', getAllEvaluated);

export default router;
