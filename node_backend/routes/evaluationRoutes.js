/**
 * Evaluation Routes — /evaluate and /product endpoints.
 */
import express from 'express';
import { evaluateStream, getProductDetails } from '../controllers/evaluationController.js';

const router = express.Router();

// SSE streaming evaluation
router.get('/evaluate/stream', evaluateStream);

// Product detail scraping
router.post('/product/details', getProductDetails);

export default router;
