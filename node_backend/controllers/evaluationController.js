/**
 * Evaluation Controller — equivalent to /evaluate/stream and /product/details endpoints.
 * Handles SSE streaming for two-phase product evaluation.
 *
 * Results are persisted to PostgreSQL: one `scan_runs` row per request and one
 * append-only `product_evaluations` row per product.
 */
const { scrapeBlinkitLive } = require('../services/scraper/blinkitLive');
const { scrapeZeptoLive } = require('../services/scraper/zeptoLive');
const { scrapeBlinkitDetail } = require('../services/scraper/blinkitDetail');
const { scrapeZeptoDetail } = require('../services/scraper/zeptoDetail');
const { validateProduct } = require('../services/ruleEngine');
const { analyzeWithGemini } = require('../services/aiService');
const { combineScores } = require('../services/scoringEngine');
const { addEvaluatedProduct } = require('../services/dashboardService');
const scanRunRepository = require('../repositories/scanRunRepository');

function sseEvent(eventType, data) {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Database failures must abort the stream rather than silently dropping results. */
function isDatabaseError(err) {
  return Boolean(err) && (err.code === 'DB_UNAVAILABLE' || err.name === 'DatabaseUnavailableError');
}

/**
 * GET /evaluate/stream — SSE streaming endpoint
 */
async function evaluateStream(req, res) {
  const productName = req.query.product_name;
  if (!productName) {
    return res.status(400).json({ error: 'product_name is required' });
  }

  // Create the scan run before streaming so DB problems fail loudly up-front
  // (a normal 503) instead of mid-stream.
  let scanRun;
  try {
    scanRun = await scanRunRepository.startScanRun({ query: productName });
  } catch (err) {
    console.error(`❌ Could not start scan run: ${err.message}`);
    return res.status(503).json({
      error: 'Database unavailable',
      detail: 'Could not create a scan run. Check DATABASE_URL and PostgreSQL connectivity.',
      message: err.message,
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const startTime = Date.now();
  let productsFound = 0;
  let evaluatedCount = 0;

  try {
    // ═══ PHASE 1: Quick Scrape ═══
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 PHASE 1: Quick Scraping for '${productName}'`);
    console.log(`${'='.repeat(60)}`);

    res.write(sseEvent('status', { message: `Searching for '${productName}' on Zepto & Blinkit...`, phase: 'scraping' }));

    // Run both live scrapers in parallel
    console.log(`  📡 Launching parallel scrapers (Zepto + Blinkit)...`);
    const [zeptoResults, blinkitResults] = await Promise.allSettled([
      scrapeZeptoLive(productName),
      scrapeBlinkitLive(productName),
    ]);

    // Combine results — Zepto first, then Blinkit
    const scraped = [];
    if (Array.isArray(zeptoResults.value)) {
      scraped.push(...zeptoResults.value.slice(0, 5));
      console.log(`  ✅ Zepto: Found ${zeptoResults.value.length} products (using top ${Math.min(5, zeptoResults.value.length)})`);
    } else {
      console.log(`  ⚠️ Zepto scraping failed: ${zeptoResults.reason || zeptoResults.value}`);
    }

    if (Array.isArray(blinkitResults.value)) {
      scraped.push(...blinkitResults.value.slice(0, 5));
      console.log(`  ✅ Blinkit: Found ${blinkitResults.value.length} products (using top ${Math.min(5, blinkitResults.value.length)})`);
    } else {
      console.log(`  ⚠️ Blinkit scraping failed: ${blinkitResults.reason || blinkitResults.value}`);
    }

    const phase1Time = (Date.now() - startTime) / 1000;
    productsFound = scraped.length;
    console.log(`\n  ⏱ Phase 1 completed in ${phase1Time.toFixed(1)}s — ${scraped.length} products found`);

    await scanRunRepository.updateScanRunProgress(scanRun.id, { products_found: productsFound });

    if (scraped.length === 0) {
      console.log(`  ❌ No products found!`);
      res.write(sseEvent('error', { message: 'No products found. Try a different search term.' }));
      res.write(sseEvent('complete', { total: 0, time: Math.round(phase1Time * 10) / 10 }));
      await scanRunRepository.finishScanRun(scanRun.id, {
        status: 'completed',
        duration_ms: Date.now() - startTime,
        products_found: 0,
        products_evaluated: 0,
      });
      res.end();
      return;
    }

    // Send basic product listings immediately
    const basicProducts = scraped.map((product, i) => ({
      index: i,
      product: {
        name: product.product_name || product.name || 'Unknown',
        price: product.price || 'N/A',
        mrp: product.mrp || 'N/A',
        discount: product.discount || '0',
        weight: product.weight || 'N/A',
        platform: product.platform || 'unknown',
        store_name: product.store_name || 'Unknown',
        product_image: product.product_image || '',
        product_url: product.product_url || '',
      },
      compliance: null,
      status: 'pending',
    }));

    res.write(sseEvent('products_found', {
      count: basicProducts.length,
      products: basicProducts,
      phase1_time: Math.round(phase1Time * 10) / 10,
    }));

    // ═══ PHASE 2: Deep Scraping + Compliance Analysis ═══
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔬 PHASE 2: Deep Scraping & Compliance Analysis`);
    console.log(`${'='.repeat(60)}`);

    for (let i = 0; i < scraped.length; i++) {
      const product = scraped[i];
      const productNameStr = product.product_name || product.name || 'Unknown';
      const productUrl = product.product_url || '';
      const platform = product.platform || 'unknown';
      const productStart = Date.now();

      console.log(`\n  ┌─ Product [${i + 1}/${scraped.length}]: ${productNameStr.slice(0, 50)}`);
      console.log(`  │  Platform: ${platform}`);

      res.write(sseEvent('product_evaluating', {
        index: i,
        product_name: productNameStr,
        step: 'deep_scraping',
      }));

      try {
        // Step 1: Deep scrape
        let deepData = { ...product };
        let deepScrapeSuccess = false;

        if (productUrl && productUrl.startsWith('http')) {
          console.log(`  │  📄 Step 1: Deep scraping product page...`);
          res.write(sseEvent('product_step', { index: i, step: 'deep_scraping', message: `Scraping full details for ${productNameStr.slice(0, 30)}...` }));

          try {
            let detail;
            if (platform.toLowerCase().includes('zepto') || productUrl.toLowerCase().includes('zepto')) {
              detail = await scrapeZeptoDetail(productUrl);
            } else {
              detail = await scrapeBlinkitDetail(productUrl);
            }

            if (detail) {
              const regFields = ['fssai_number', 'ingredients', 'manufacturer_name', 'expiry_date'];
              const gotRegData = regFields.some(f =>
                detail[f] && String(detail[f]).trim() !== '' && String(detail[f]).trim() !== 'N/A' && String(detail[f]).trim() !== 'null'
              );
              // Merge deep data
              for (const [key, value] of Object.entries(detail)) {
                if (value && String(value).trim() !== '' && String(value).trim() !== 'N/A' && String(value).trim() !== 'null') {
                  deepData[key] = value;
                }
              }
              deepScrapeSuccess = gotRegData;
              console.log(`  │  ✅ Deep scrape ${gotRegData ? 'successful — got regulatory data' : 'partial — no regulatory data found'}`);
            } else {
              console.log(`  │  ⚠️ Deep scrape returned no data`);
            }
          } catch (deepErr) {
            console.log(`  │  ⚠️ Deep scrape failed: ${String(deepErr).slice(0, 80)}`);
          }
        } else {
          console.log(`  │  ⚠️ No product URL — skipping deep scrape`);
        }

        // Step 2: Rule Engine
        console.log(`  │  📋 Step 2: Running rule engine validation...`);
        res.write(sseEvent('product_step', { index: i, step: 'rule_engine', message: 'Validating compliance rules...' }));
        const ruleResult = validateProduct(deepData, deepScrapeSuccess);
        console.log(`  │  ✅ Rule engine: Score=${ruleResult.rule_score}, Violations=${ruleResult.violations.length}`);

        // Step 3: AI Analysis
        console.log(`  │  🤖 Step 3: Running Gemini AI analysis...`);
        res.write(sseEvent('product_step', { index: i, step: 'ai_analysis', message: 'Analyzing with Gemini AI...' }));
        const aiResult = await analyzeWithGemini(deepData, deepScrapeSuccess);
        console.log(`  │  ✅ AI analysis: Score=${aiResult.ai_score}, Risk=${aiResult.ai_risk}`);

        // Step 4: Combine scores
        console.log(`  │  📊 Step 4: Combining scores...`);
        const final = combineScores(ruleResult, aiResult);
        const productTime = (Date.now() - productStart) / 1000;
        console.log(`  │  🏁 Final Score: ${final.score}/100, Risk: ${final.risk}`);
        console.log(`  └─ Completed in ${productTime.toFixed(1)}s`);

        // Build output
        const productOut = {
          name: deepData.product_name || deepData.name || 'Unknown',
          price: deepData.price || 'N/A',
          mrp: deepData.mrp || 'N/A',
          discount: deepData.discount || '0',
          weight: deepData.weight || 'N/A',
          ingredients: deepData.ingredients || 'N/A',
          fssai_number: deepData.fssai_number || 'N/A',
          manufacturer_name: deepData.manufacturer_name || 'N/A',
          manufacturer_address: deepData.manufacturer_address || 'N/A',
          expiry_date: deepData.expiry_date || 'N/A',
          platform: deepData.platform || 'unknown',
          store_name: deepData.store_name || 'Unknown',
          product_image: deepData.product_image || '',
          product_url: deepData.product_url || '',
        };

        const complianceOut = {
          score: final.score,
          rule_score: final.rule_score,
          risk: final.risk,
          violations: final.violations,
          passed_rules: final.passed_rules,
          total_rules: final.total_rules,
        };

        const deepNote = deepScrapeSuccess ? '' : ' Based on listing data only (product detail page was not accessible).';
        const violationCount = final.violations.filter(v => v.severity !== 'INFO').length;
        const aiOut = {
          ai_score: aiResult.ai_score || 0,
          summary: `Compliance score: ${final.score}/100 — ${violationCount} issue(s) found.${deepNote}`,
          risk_level: final.risk.toUpperCase(),
          detailed_insights: aiResult.detailed_insights || '',
          recommendations: aiResult.recommendations || [],
          status: aiResult.ai_status || 'Complete',
          final_score: final.score,
          deep_scrape_available: deepScrapeSuccess,
        };

        // Persist to PostgreSQL (product identity + listing + append-only evaluation)
        await addEvaluatedProduct(productOut, complianceOut, aiOut, platform, {
          scanRunId: scanRun.id,
          deepProduct: deepData,
          deepScrapeAvailable: deepScrapeSuccess,
        });
        evaluatedCount++;

        res.write(sseEvent('product_evaluated', {
          index: i,
          product: productOut,
          compliance: complianceOut,
          ai_analysis: aiOut,
          time: Math.round(productTime * 10) / 10,
        }));
      } catch (productErr) {
        const productTime = (Date.now() - productStart) / 1000;
        console.log(`  │  ❌ Error: ${productErr.message}`);
        console.log(`  └─ Failed after ${productTime.toFixed(1)}s`);

        // A database outage must not be swallowed — abort the whole stream.
        if (isDatabaseError(productErr)) throw productErr;

        res.write(sseEvent('product_error', {
          index: i,
          product_name: productNameStr,
          error: productErr.message,
        }));
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ ALL DONE — ${scraped.length} products processed in ${totalTime.toFixed(1)}s`);
    console.log(`${'='.repeat(60)}\n`);

    await scanRunRepository.finishScanRun(scanRun.id, {
      status: 'completed',
      duration_ms: Date.now() - startTime,
      products_found: productsFound,
      products_evaluated: evaluatedCount,
    });

    res.write(sseEvent('complete', {
      total: scraped.length,
      time: Math.round(totalTime * 10) / 10,
    }));

    res.end();
  } catch (err) {
    console.error('Stream error:', err);

    try {
      await scanRunRepository.finishScanRun(scanRun.id, {
        status: 'failed',
        duration_ms: Date.now() - startTime,
        products_found: productsFound,
        products_evaluated: evaluatedCount,
        error: err.message,
      });
    } catch (finishErr) {
      console.error(`  ⚠️ Could not mark scan run ${scanRun.id} as failed: ${finishErr.message}`);
    }

    const message = isDatabaseError(err)
      ? 'Database unavailable — evaluation results could not be stored. Please check the database connection.'
      : err.message;

    res.write(sseEvent('error', { message }));
    res.end();
  }
}

/**
 * POST /product/details — Scrape full product details
 */
async function getProductDetails(req, res) {
  const { product_url: productUrl, platform = 'blinkit' } = req.query;

  if (!productUrl || !productUrl.startsWith('http')) {
    return res.json({ error: 'Invalid product URL' });
  }

  console.log(`\n🔎 Fetching product details from ${platform}: ${productUrl}`);

  try {
    let detail;
    if (platform.toLowerCase().includes('zepto') || productUrl.toLowerCase().includes('zepto')) {
      detail = await scrapeZeptoDetail(productUrl);
    } else {
      detail = await scrapeBlinkitDetail(productUrl);
    }

    console.log(`✓ Product detail fetched: ${detail.product_name}`);
    res.json({ status: 'success', detail });
  } catch (e) {
    console.log(`✗ Product detail fetch failed: ${e.message}`);
    res.json({ error: e.message, detail: null });
  }
}

module.exports = { evaluateStream, getProductDetails };
