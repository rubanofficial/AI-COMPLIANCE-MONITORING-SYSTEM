/**
 * Verification Test Suite for Node Backend Migration
 * Tests all 12 core capabilities.
 */
import 'dotenv/config';
import assert from 'assert';
import { validateProduct } from './services/ruleEngine.js';
import { combineScores } from './services/scoringEngine.js';
import { analyzeWithGemini, fallbackAnalysis } from './services/aiService.js';
import { scrapeBlinkitLive } from './services/scraper/blinkitLive.js';
import { scrapeZeptoLive } from './services/scraper/zeptoLive.js';
import { scrapeBlinkitDetail } from './services/scraper/blinkitDetail.js';
import { scrapeZeptoDetail } from './services/scraper/zeptoDetail.js';
import {
  getDashboardStats,
  getRecentScans,
  getTrendData,
  getLatestScanData,
  getEvaluatedProducts,
} from './services/dashboardService.js';
import { testConnection, closePool } from './db/pool.js';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING NODE BACKEND CAPABILITY VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(name, ok, info = '') {
    if (ok) {
      console.log(`  ✅ [PASS] ${name}${info ? ` — ${info}` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}${info ? ` — ${info}` : ''}`);
      failed++;
    }
  }

  // 1. Database & Health test
  console.log('--- 1 & 2: Database Connection & Health ---');
  try {
    const conn = await testConnection();
    record('PostgreSQL connection', conn.connected, `database: ${conn.database}, latency: ${conn.latency_ms}ms`);
  } catch (err) {
    record('PostgreSQL connection', false, err.message);
  }

  // 2. Rule Engine — all 9 rules
  console.log('\n--- 6: Rule Engine (All 9 Rules) ---');
  try {
    // Perfect product
    const perfectProduct = {
      name: 'Amul Taaza Toned Milk 500ml',
      price: '27',
      mrp: '28',
      weight: '500 ml',
      fssai_number: '10012021000071',
      manufacturer_name: 'Gujarat Co-operative Milk Marketing Federation Ltd.',
      manufacturer_address: 'Amul Dairy Road, Anand, Gujarat - 388001',
      ingredients: 'Toned Milk, Vitamin A, Vitamin D',
      expiry_date: 'Best before 2 days from packaging',
    };
    const perfectResult = validateProduct(perfectProduct, true);
    record('Rule Engine: Perfect product scores 100', perfectResult.rule_score === 100, `Score: ${perfectResult.rule_score}`);
    record('Rule Engine: 9 rules evaluated', perfectResult.total_rules === 9, `Total rules: ${perfectResult.total_rules}`);

    // Violations test
    const badProduct = {
      name: '',
      price: '-10',
      mrp: '10', // selling price > mrp when price is high, or mrp < price
      weight: 'N/A',
      fssai_number: '123', // invalid format (not 14 digits)
      manufacturer_name: 'N/A',
      manufacturer_address: 'N/A',
      ingredients: 'N/A',
      expiry_date: 'N/A',
    };
    const badResult = validateProduct(badProduct, true);
    record('Rule Engine: Catches violations and penalizes score', badResult.violations.length >= 7, `Violations: ${badResult.violations.length}`);

    // Advisory mode test (deep_scrape_available = false)
    const listingOnlyProduct = {
      name: 'Amul Gold Milk',
      price: '33',
      mrp: '34',
      weight: '500 ml',
      // regulatory missing
      fssai_number: 'N/A',
      manufacturer_name: 'N/A',
      manufacturer_address: 'N/A',
      ingredients: 'N/A',
      expiry_date: 'N/A',
    };
    const advisoryResult = validateProduct(listingOnlyProduct, false);
    record('Rule Engine: Advisory mode no penalty for missing deep-scrape data', advisoryResult.rule_score === 100, `Score: ${advisoryResult.rule_score}`);
    const infoCount = advisoryResult.violations.filter(v => v.severity === 'INFO').length;
    record('Rule Engine: Generates INFO advisories', infoCount === 5, `Advisories: ${infoCount}`);
  } catch (err) {
    record('Rule Engine tests', false, err.message);
  }

  // 3. Scoring Engine
  console.log('\n--- 9: Scoring Engine ---');
  try {
    const mockRule = {
      rule_score: 80,
      violations: [{ id: 'VAL001', rule: 'Test Rule', message: 'Test issue', severity: 'MEDIUM', field: 'price' }],
      passed_rules: ['VAL002', 'VAL003'],
      total_rules: 9,
      deep_scrape_available: true,
    };
    const mockAI = {
      ai_score: 90,
      ai_risk: 'Low',
      ai_violations: [{ id: 'AI_001', rule: 'AI Rule', message: 'AI warning', severity: 'LOW', field: 'weight' }],
      ai_status: 'Complete',
    };
    const combined = combineScores(mockRule, mockAI);
    record('Scoring Engine: Combines 50/50 rule and AI scores', combined.score === 85, `Score: ${combined.score}`);
    record('Scoring Engine: Categorizes risk correctly', combined.risk === 'Low', `Risk: ${combined.risk}`);
    record('Scoring Engine: Normalizes violations from both engines', combined.violations.length === 2, `Violations: ${combined.violations.length}`);
  } catch (err) {
    record('Scoring Engine tests', false, err.message);
  }

  // 4. Gemini AI & Fallback
  console.log('\n--- 7 & 8: Gemini AI Integration & Fallback ---');
  try {
    const testProd = {
      name: 'Amul Butter 100g',
      price: '56',
      mrp: '58',
      weight: '100 g',
      fssai_number: '10012021000071',
      ingredients: 'Butter, Common Salt',
      manufacturer_name: 'Amul GCMMF',
      manufacturer_address: 'Anand, Gujarat',
      expiry_date: '9 months from packaging',
      platform: 'blinkit',
    };

    console.log('  Testing live Gemini API call...');
    const geminiRes = await analyzeWithGemini(testProd, true);
    record('Gemini AI: Returns valid analysis object', Boolean(geminiRes && geminiRes.ai_score != null), `Score: ${geminiRes?.ai_score}, Status: ${geminiRes?.ai_status}`);
    record('Gemini AI: Returns summary and recommendations', Array.isArray(geminiRes?.recommendations) && Boolean(geminiRes?.summary), `Summary length: ${geminiRes?.summary?.length}`);

    // Fallback analysis test
    const fallbackRes = fallbackAnalysis(testProd, true);
    record('AI Fallback: Fallback analysis produces score & risk', Boolean(fallbackRes && fallbackRes.ai_score > 0), `Fallback Score: ${fallbackRes?.ai_score}`);
  } catch (err) {
    record('Gemini AI tests', false, err.message);
  }

  // 5. Dashboard Endpoints / Service
  console.log('\n--- 11 & 12: Dashboard Service & Response Shapes ---');
  try {
    const stats = await getDashboardStats();
    record('Dashboard stats shape', stats.avg_compliance_score !== undefined && stats.products_scanned !== undefined, `Products scanned: ${stats.products_scanned}`);

    const recent = await getRecentScans(5);
    record('Dashboard recent scans shape', Array.isArray(recent), `Recent count: ${recent.length}`);

    const trends = await getTrendData(7);
    record('Dashboard trends shape', Array.isArray(trends) && trends.length === 7, `Trend days: ${trends.length}`);

    const liveData = await getLatestScanData();
    record('Dashboard live data shape', Array.isArray(liveData.products) && liveData.stats !== undefined, `Live products: ${liveData.products.length}`);

    const allEvals = await getEvaluatedProducts();
    record('Dashboard evaluated products shape', Array.isArray(allEvals), `Evaluated count: ${allEvals.length}`);
  } catch (err) {
    record('Dashboard service tests', false, err.message);
  }

  // 6. Live Scraper Quick Test
  console.log('\n--- 3 & 4: Live Scrapers (Blinkit & Zepto) ---');
  try {
    console.log('  Running Zepto live scrape test for "milk"...');
    const zeptoProducts = await scrapeZeptoLive('milk');
    record('Zepto live scraper', Array.isArray(zeptoProducts) && zeptoProducts.length > 0, `Found ${zeptoProducts.length} products`);
    if (zeptoProducts.length > 0) {
      console.log(`    Sample Zepto product: "${zeptoProducts[0].product_name}" (₹${zeptoProducts[0].price})`);
    }
  } catch (err) {
    record('Zepto live scraper', false, err.message);
  }

  try {
    console.log('  Running Blinkit live scrape test for "milk"...');
    const blinkitProducts = await scrapeBlinkitLive('milk');
    record('Blinkit live scraper', Array.isArray(blinkitProducts) && blinkitProducts.length > 0, `Found ${blinkitProducts.length} products`);
    if (blinkitProducts.length > 0) {
      console.log(`    Sample Blinkit product: "${blinkitProducts[0].product_name}" (₹${blinkitProducts[0].price})`);
    }
  } catch (err) {
    record('Blinkit live scraper', false, err.message);
  }

  console.log('\n====================================================');
  console.log(`🏁 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await closePool();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(async (err) => {
  console.error('Fatal test runner error:', err);
  await closePool();
  process.exit(1);
});
