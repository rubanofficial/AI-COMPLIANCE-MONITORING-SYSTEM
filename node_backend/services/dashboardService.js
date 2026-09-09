/**
 * Dashboard Service — equivalent to services/dashboard_service.py
 * Manages scan history, statistics, and output.json persistence.
 */
const fs = require('fs');
const path = require('path');
const { OUTPUT_FILE } = require('../config/settings');

// In-memory storage
let scanHistory = [];
let evaluatedProducts = [];

function saveOutput() {
  const data = {
    last_updated: new Date().toISOString(),
    total_products: evaluatedProducts.length,
    scan_history: scanHistory,
    evaluated_products: evaluatedProducts,
  };
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`    💾 [output.json] Saved ${evaluatedProducts.length} products`);
  } catch (e) {
    console.log(`    ⚠️ [output.json] Save failed: ${e.message}`);
  }
}

function loadOutput() {
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const raw = fs.readFileSync(OUTPUT_FILE, 'utf-8');
      const data = JSON.parse(raw);
      scanHistory = data.scan_history || [];
      evaluatedProducts = data.evaluated_products || [];
      console.log(`    ✅ [output.json] Loaded ${evaluatedProducts.length} products, ${scanHistory.length} scans`);
    } catch (e) {
      console.log(`    ⚠️ [output.json] Load failed: ${e.message}`);
    }
  }
}

function addEvaluatedProduct(productData, complianceData, aiAnalysis, platform) {
  const entry = {
    product: productData,
    compliance: complianceData,
    ai_analysis: aiAnalysis,
    platform,
    evaluated_at: new Date().toISOString(),
  };
  evaluatedProducts.push(entry);
  saveOutput();
  return entry;
}

function getEvaluatedProducts() {
  return [...evaluatedProducts].reverse(); // Newest first
}

function getLatestScanData() {
  if (evaluatedProducts.length === 0) {
    return { products: [], stats: getDashboardStats() };
  }
  return {
    products: [...evaluatedProducts].reverse().slice(0, 20),
    stats: getDashboardStats(),
  };
}

function addScanToHistory(productName, platform, complianceScore, risk) {
  scanHistory.push({
    name: productName,
    platform,
    score: complianceScore,
    risk,
    timestamp: new Date().toISOString(),
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  });

  // Keep only last 100 scans
  if (scanHistory.length > 100) {
    scanHistory.shift();
  }
  saveOutput();
}

function getRecentScans(limit = 10) {
  return [...scanHistory].slice(-limit).reverse();
}

function getDashboardStats() {
  if (scanHistory.length === 0) {
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

  const totalScore = scanHistory.reduce((sum, s) => sum + s.score, 0);
  const avgScore = Math.floor(totalScore / scanHistory.length);

  let totalViolations = 0;
  let totalCritical = 0;
  let totalHigh = 0;
  let totalPassed = 0;
  let totalRulesSum = 0;

  for (const ep of evaluatedProducts) {
    const comp = ep.compliance || {};
    const violations = comp.violations || [];
    totalViolations += violations.length;
    for (const v of violations) {
      const sev = (v.severity || 'MEDIUM').toUpperCase();
      if (sev === 'CRITICAL') totalCritical++;
      else if (sev === 'HIGH') totalHigh++;
    }
    totalPassed += (comp.passed_rules || []).length;
    totalRulesSum += comp.total_rules || 0;
  }

  // If no evaluated products, approximate from scores
  if (evaluatedProducts.length === 0) {
    totalViolations = scanHistory.reduce((sum, s) => sum + Math.max(0, Math.floor((100 - s.score) / 10)), 0);
    totalCritical = scanHistory.filter(s => s.score < 50).length;
    totalHigh = scanHistory.filter(s => s.score >= 50 && s.score < 70).length;
    totalPassed = Math.floor((avgScore * 14) / 100);
    totalRulesSum = 14 * scanHistory.length;
  }

  const rulesPassingPct = totalRulesSum > 0 ? Math.floor((totalPassed * 100) / totalRulesSum) : 0;

  return {
    avg_compliance_score: avgScore,
    products_scanned: scanHistory.length,
    total_violations: totalViolations,
    rules_passing_percentage: rulesPassingPct,
    passed_rules_count: totalPassed,
    total_rules: totalRulesSum > 0 ? totalRulesSum : 14,
    total_critical: totalCritical,
    total_high: totalHigh,
  };
}

function getTrendData(days = 7) {
  const today = new Date();

  // Build a map of actual scan data keyed by date string
  const scanMap = {};
  for (const scan of scanHistory) {
    let dateObj;
    try {
      dateObj = new Date(scan.timestamp);
    } catch {
      continue;
    }
    const dateKey = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (!scanMap[dateKey]) {
      scanMap[dateKey] = { dateObj, scores: [], violations: [], products_scanned: 0 };
    }
    scanMap[dateKey].scores.push(scan.score || 0);
    scanMap[dateKey].violations.push(Math.max(0, Math.floor((100 - (scan.score || 0)) / 10)));
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

function initializeSampleData() {
  loadOutput();
  if (evaluatedProducts.length > 0) {
    console.log(`✓ Dashboard loaded ${evaluatedProducts.length} products, ${scanHistory.length} scans from output.json`);
  } else {
    console.log('✓ Dashboard initialized (no previous data — scan products to populate)');
  }
}

module.exports = {
  addEvaluatedProduct,
  getEvaluatedProducts,
  getLatestScanData,
  addScanToHistory,
  getRecentScans,
  getDashboardStats,
  getTrendData,
  initializeSampleData,
};
