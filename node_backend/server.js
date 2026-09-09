/**
 * Server — equivalent to main.py (FastAPI → Express.js)
 * AI Compliance Monitoring System — Node.js Backend
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initializeSampleData } = require('./services/dashboardService');

const evaluationRoutes = require('./routes/evaluationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 8006;

// CORS — allow all origins for local development (matches Python version)
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['*'],
  allowedHeaders: ['*'],
}));

// Parse JSON bodies
app.use(express.json());

// Mount routes
app.use(evaluationRoutes);
app.use(dashboardRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI Compliance Monitoring System — Node.js Backend',
    port: PORT,
    gemini_api_key: process.env.GEMINI_API_KEY ? 'SET' : 'MISSING',
  });
});

// Initialize sample data on startup
initializeSampleData();

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://127.0.0.1:${PORT}`);
  console.log(`   Gemini API Key: ${process.env.GEMINI_API_KEY ? 'SET' : 'MISSING'}`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /evaluate/stream?product_name=...`);
  console.log(`     POST /product/details?product_url=...&platform=...`);
  console.log(`     GET  /dashboard/stats`);
  console.log(`     GET  /dashboard/recent-scans?limit=...`);
  console.log(`     GET  /dashboard/trends?days=...`);
  console.log(`     GET  /dashboard/live-data`);
  console.log(`     GET  /dashboard/evaluated-products\n`);
});
