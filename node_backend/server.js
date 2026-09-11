/**
 * Server — equivalent to main.py (FastAPI → Express.js)
 * AI Compliance Monitoring System — Node.js Backend
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { testConnection, hasDatabase, closePool } = require('./db/pool');

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
    database: hasDatabase() ? 'configured' : 'not_configured',
  });
});

// Extended health check — verifies the live database connection
app.get('/health/db', async (req, res) => {
  const status = await testConnection();
  res.status(status.connected ? 200 : 503).json(status);
});

// Error middleware — database outages fail loudly as 503, everything else as 500
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isDbError = err && (err.code === 'DB_UNAVAILABLE' || err.name === 'DatabaseUnavailableError');

  if (isDbError) {
    console.error(`❌ [db] ${req.method} ${req.originalUrl} — ${err.message}`);
    return res.status(503).json({
      error: 'Database unavailable',
      message: err.message,
    });
  }

  console.error(`❌ ${req.method} ${req.originalUrl} — ${(err && err.stack) || err}`);
  res.status(err && err.status ? err.status : 500).json({
    error: (err && err.message) || 'Internal server error',
  });
});

async function start() {
  // Verify the database connection before accepting traffic.
  const dbStatus = await testConnection();
  if (!dbStatus.connected) {
    console.error('\n⚠️  DATABASE NOT AVAILABLE');
    console.error(`   ${dbStatus.error}`);
    console.error('   Set DATABASE_URL in node_backend/.env, then run: npm run db:setup');
    console.error('   Data endpoints will respond with HTTP 503 until the database is reachable.\n');
  } else {
    console.log(`\n✅ PostgreSQL connected: ${dbStatus.database} (${dbStatus.latency_ms}ms)`);
  }

  const server = app.listen(PORT, () => {
    console.log(`\n✅ Server running on http://127.0.0.1:${PORT}`);
    console.log(`   Gemini API Key: ${process.env.GEMINI_API_KEY ? 'SET' : 'MISSING'}`);
    console.log(`   Database: ${dbStatus.connected ? 'CONNECTED' : 'UNAVAILABLE'}`);
    console.log(`   Endpoints:`);
    console.log(`     GET  /evaluate/stream?product_name=...`);
    console.log(`     POST /product/details?product_url=...&platform=...`);
    console.log(`     GET  /dashboard/stats`);
    console.log(`     GET  /dashboard/recent-scans?limit=...`);
    console.log(`     GET  /dashboard/trends?days=...`);
    console.log(`     GET  /dashboard/live-data`);
    console.log(`     GET  /dashboard/evaluated-products`);
    console.log(`     GET  /health/db\n`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down...`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();

module.exports = app;
