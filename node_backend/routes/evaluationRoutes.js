/**
 * Evaluation Routes — /evaluate and /product endpoints.
 */
const express = require('express');
const router = express.Router();
const { evaluateStream, getProductDetails } = require('../controllers/evaluationController');

// SSE streaming evaluation
router.get('/evaluate/stream', evaluateStream);

// Product detail scraping
router.post('/product/details', getProductDetails);

module.exports = router;
