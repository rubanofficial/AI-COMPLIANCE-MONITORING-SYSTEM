/**
 * Dashboard Routes — /dashboard endpoints.
 */
const express = require('express');
const router = express.Router();
const {
  getStats,
  getRecent,
  getTrends,
  getLiveData,
  getAllEvaluated,
} = require('../controllers/dashboardController');

router.get('/dashboard/stats', getStats);
router.get('/dashboard/recent-scans', getRecent);
router.get('/dashboard/trends', getTrends);
router.get('/dashboard/live-data', getLiveData);
router.get('/dashboard/evaluated-products', getAllEvaluated);

module.exports = router;
