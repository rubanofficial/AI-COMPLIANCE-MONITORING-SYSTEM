/**
 * Dashboard Service — PostgreSQL-backed scan history, statistics and
 * evaluated-product reads.
 *
 * This replaces the previous in-memory + output.json implementation. The
 * exported function names and the JSON shapes returned to the React frontend
 * are unchanged; the only difference is that every function is now async and
 * reads from PostgreSQL.
 *
 * Scan history is derived from `product_evaluations` rather than a separate
 * table, so there is a single source of truth for scans.
 */
import * as evaluationRepository from '../repositories/evaluationRepository.js';
import * as dashboardRepository from '../repositories/dashboardRepository.js';

/**
 * Persist an evaluated product.
 *
 * @param {object} productData      Product snapshot returned to the frontend.
 * @param {object} complianceData   { score, rule_score, risk, violations, passed_rules, total_rules }
 * @param {object} aiAnalysis       AI payload.
 * @param {string} platform         Platform slug (blinkit/zepto).
 * @param {object} [options]        { scanRunId, deepProduct, deepScrapeAvailable, evaluatedAt }
 */
export async function addEvaluatedProduct(productData, complianceData, aiAnalysis, platform, options = {}) {
  const saved = await evaluationRepository.saveEvaluation({
    scanRunId: options.scanRunId ?? null,
    product: productData,
    deepProduct: options.deepProduct ?? null,
    compliance: complianceData,
    aiAnalysis,
    platform: platform || productData.platform || 'unknown',
    deepScrapeAvailable:
      options.deepScrapeAvailable ?? (complianceData && complianceData.deep_scrape_available) ?? false,
    evaluatedAt: options.evaluatedAt ?? null,
  });

  return {
    product: productData,
    compliance: complianceData,
    ai_analysis: aiAnalysis,
    platform: platform || productData.platform || 'unknown',
    evaluated_at: (options.evaluatedAt || saved.evaluation.evaluated_at || new Date()).toString(),
  };
}

/** Newest evaluations first, in the frontend's expected shape. */
export async function getEvaluatedProducts() {
  return evaluationRepository.getEvaluatedProducts();
}

export async function getLatestScanData() {
  const [products, stats] = await Promise.all([
    evaluationRepository.getEvaluatedProducts({ limit: 20 }),
    getDashboardStats(),
  ]);
  return { products, stats };
}

/**
 * @deprecated Scan history is now derived from product_evaluations, which
 * `addEvaluatedProduct` writes. Calling this has no effect; it is retained so
 * the previous public API of this service does not break.
 */
export function addScanToHistory() {
  console.warn('[dashboardService] addScanToHistory() is deprecated — scan history is derived from product_evaluations.');
  return null;
}

/** Recent scans, newest first, matching the previous response shape exactly. */
export async function getRecentScans(limit = 10) {
  const rows = await dashboardRepository.getRecentScans(limit);
  return rows.map((row) => {
    const score = row.final_score;
    const evaluatedAt = row.evaluated_at instanceof Date ? row.evaluated_at : new Date(row.evaluated_at);
    return {
      name: row.name,
      platform: row.platform,
      score,
      risk: score >= 80 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH',
      timestamp: evaluatedAt.toISOString(),
      time: evaluatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };
  });
}

export async function getDashboardStats() {
  const row = await dashboardRepository.getStats();
  const productsScanned = row.products_scanned || 0;

  if (productsScanned === 0) {
    return {
      avg_compliance_score: 0,
      products_scanned: 0,
      total_violations: 0,
      rules_passing_percentage: 0,
      total_critical: 0,
      total_high: 0,
      passed_rules_count: 0,
      total_rules: 14,
    };
  }

  const totalRules = row.total_rules > 0 ? row.total_rules : 14;
  const passedRules = row.passed_rules_count || 0;

  return {
    avg_compliance_score: row.avg_score || 0,
    products_scanned: productsScanned,
    total_violations: row.total_violations || 0,
    rules_passing_percentage: totalRules > 0 ? Math.floor((passedRules * 100) / totalRules) : 0,
    passed_rules_count: passedRules,
    total_rules: totalRules,
    total_critical: row.total_critical || 0,
    total_high: row.total_high || 0,
  };
}

/** Daily trend for the last `days` days, including empty days as nulls. */
export async function getTrendData(days = 7) {
  const rows = await evaluationRepository.getEvaluationRowsForRange(days);
  const today = new Date();

  // Build a map of actual scan data keyed by date string
  const scanMap = {};
  for (const row of rows) {
    const dateObj = row.evaluated_at instanceof Date ? row.evaluated_at : new Date(row.evaluated_at);
    if (Number.isNaN(dateObj.getTime())) continue;

    const dateKey = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!scanMap[dateKey]) {
      scanMap[dateKey] = { scores: [], violations: [], products_scanned: 0 };
    }
    const score = row.final_score || 0;
    scanMap[dateKey].scores.push(score);
    scanMap[dateKey].violations.push(Math.max(0, Math.floor((100 - score) / 10)));
    scanMap[dateKey].products_scanned++;
  }

  // Generate a full range of dates
  const trendData = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (scanMap[dateKey]) {
      const entry = scanMap[dateKey];
      const avgScore = Math.floor(entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length);
      trendData.push({
        date: dateKey,
        score: avgScore,
        violations: entry.violations.reduce((a, b) => a + b, 0),
        products_scanned: entry.products_scanned,
      });
    } else {
      trendData.push({
        date: dateKey,
        score: null,
        violations: null,
        products_scanned: 0,
      });
    }
  }

  return trendData;
}

/**
 * @deprecated Replaced by the database startup check in server.js. Retained so
 * existing callers of the previous service API do not break.
 */
export async function initializeSampleData() {
  const status = await evaluationRepository.countEvaluations();
  console.log(`📦 Dashboard backing store: PostgreSQL (${status} evaluations)`);
  return status;
}

export default {
  addEvaluatedProduct,
  getEvaluatedProducts,
  getLatestScanData,
  addScanToHistory,
  getRecentScans,
  getDashboardStats,
  getTrendData,
  initializeSampleData,
};
