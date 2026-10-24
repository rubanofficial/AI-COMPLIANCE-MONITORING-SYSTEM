/**
 * Evaluation Controller — equivalent to /evaluate/stream and /product/details endpoints.
 * Handles SSE streaming for two-phase product evaluation.
 *
 * Results are persisted to PostgreSQL: one `scan_runs` row per request and one
 * append-only `product_evaluations` row per product.
 */
import { scrapeBlinkitLive } from '../services/scraper/blinkitLive.js';
import { scrapeZeptoLive } from '../services/scraper/zeptoLive.js';
import { scrapeBlinkitDetail } from '../services/scraper/blinkitDetail.js';
import { scrapeZeptoDetail } from '../services/scraper/zeptoDetail.js';
import { validateProduct } from '../services/ruleEngine.js';
import { analyzeWithGemini } from '../services/aiService.js';
import { combineScores } from '../services/scoringEngine.js';
import { addEvaluatedProduct } from '../services/dashboardService.js';
import * as scanRunRepository from '../repositories/scanRunRepository.js';
import { cleanPrice } from '../utils/dataCleaner.js';

function sseEvent(eventType, data) {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Price/MRP fields must be numeric — listing scrapers can produce unit-picker
 * text like "500 ml" or "Select Unit" when platform markup drifts, and those
 * values must never overwrite a valid listing price during the deep-data merge.
 */
function isNumericPrice(value) {
  return cleanPrice(value) !== null;
}

/** Database failures must abort the stream rather than silently dropping results. */
function isDatabaseError(err) {
  return Boolean(err) && (err.code === 'DB_UNAVAILABLE' || err.name === 'DatabaseUnavailableError');
}

/**
 * GET /evaluate/stream — SSE streaming endpoint
 */
export async function evaluateStream(req, res) {
  const rawProductName = req.query.product_name;
  const productName = rawProductName ? String(rawProductName).trim() : '';
  if (!productName) {
    return res.status(400).json({ error: 'product_name is required' });
  }

  // Track client disconnection to stop background scraping and LLM calls
  let clientConnected = true;
  req.on('close', () => {
    if (!res.writableEnded) {
      clientConnected = false;
      console.log(`⚠️ [SSE] Client closed connection for '${productName}'`);
    }
  });
  req.on('error', (err) => {
    clientConnected = false;
    console.warn(`⚠️ [SSE] Request error for '${productName}': ${err.message}`);
  });
  res.on('error', (err) => {
    clientConnected = false;
    console.warn(`⚠️ [SSE] Response socket error for '${productName}': ${err.message}`);
  });

  const safeWrite = (eventType, data) => {
    if (!clientConnected || res.writableEnded || !res.writable) return;
    try {
      res.write(sseEvent(eventType, data), (err) => {
        if (err) {
          clientConnected = false;
          console.warn(`[SSE] Write error (client disconnected): ${err.message}`);
        }
      });
    } catch (writeErr) {
      clientConnected = false;
      console.warn(`[SSE] Write error (client disconnected): ${writeErr.message}`);
    }
  };

  const safeEnd = () => {
    if (clientConnected && !res.writableEnded && res.writable) {
      try {
        res.end();
      } catch (endErr) {
        console.warn(`[SSE] End error: ${endErr.message}`);
      }
    }
  };

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
    // ─── PHASE 1: Quick Scrape ───
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 PHASE 1: Quick Scraping for '${productName}'`);
    console.log(`${'='.repeat(60)}`);

    safeWrite('status', { message: `Searching for '${productName}' on Zepto & Blinkit...`, phase: 'scraping' });

    // Run both live scrapers in parallel
    console.log(`  🚀 Launching parallel scrapers (Zepto + Blinkit)...`);
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
    console.log(`\n  ⏱️ Phase 1 completed in ${phase1Time.toFixed(1)}s — ${scraped.length} products found`);

    if (!clientConnected) {
      console.log(`🛑 [SSE] Client disconnected after Phase 1 — aborting scan run.`);
      await scanRunRepository.finishScanRun(scanRun.id, {
        status: 'failed',
        duration_ms: Date.now() - startTime,
        products_found: productsFound,
        products_evaluated: evaluatedCount,
        error: 'Client disconnected',
      });
      return;
    }

    await scanRunRepository.updateScanRunProgress(scanRun.id, { products_found: productsFound });

    if (scraped.length === 0) {
      console.log(`  ❌ No products found!`);
      safeWrite('error', { message: 'No products found. Try a different search term.' });
      await scanRunRepository.finishScanRun(scanRun.id, {
        status: 'completed',
        duration_ms: Date.now() - startTime,
        products_found: 0,
        products_evaluated: 0,
      });
      safeEnd();
      return;
    }

    // Send phase 1 results
    safeWrite('products_found', {
      count: scraped.length,
      phase1_time: Math.round(phase1Time * 10) / 10,
      products: scraped.map((p, i) => {
        const prodData = {
          name: p.product_name || p.name || 'Product',
          product_name: p.product_name || p.name || 'Product',
          price: p.price,
          mrp: p.mrp,
          weight: p.weight || 'N/A',
          platform: p.platform,
          image: p.product_image,
          product_image: p.product_image,
          product_url: p.product_url,
          store_name: p.store_name || p.platform,
        };
        return {
          index: i,
          ...prodData,
          product: prodData,
        };
      }),
    });

    // ─── PHASE 2: Deep Evaluation ───
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🛡️ PHASE 2: Deep Compliance Evaluation (${scraped.length} products)`);
    console.log(`${'='.repeat(60)}`);

    for (let i = 0; i < scraped.length; i++) {
      if (!clientConnected) {
        console.log(`🛑 [SSE] Aborting Phase 2 loop at product ${i + 1}/${scraped.length}: client disconnected.`);
        break;
      }
      const product = scraped[i];
      const productStart = Date.now();
      const productNameStr = product.product_name || product.name || `Product #${i + 1}`;
      const platform = product.platform || 'unknown';
      const productUrl = product.product_url || '';

      console.log(`\n[${i + 1}/${scraped.length}] Evaluating: "${productNameStr.slice(0, 45)}" (${platform})`);

      safeWrite('product_evaluating', {
        index: i,
        product_name: productNameStr,
        platform,
        step: 'starting',
      });

      try {
        // Step 1: Deep Scrape
        let deepData = { ...product };
        let deepScrapeSuccess = false;

        if (productUrl && productUrl.startsWith('http')) {
          console.log(`  ├─  🔍 Step 1: Deep scraping product page...`);
          safeWrite('product_step', { index: i, step: 'deep_scrape', message: 'Extracting product details...' });

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
              // Merge deep data — but only accept numeric price/mrp values,
              // so detail-page unit-picker text can't poison clean listing prices.
              for (const [key, value] of Object.entries(detail)) {
                if (!value || String(value).trim() === '' || String(value).trim() === 'N/A' || String(value).trim() === 'null') continue;
                if ((key === 'price' || key === 'mrp') && !isNumericPrice(value)) continue;
                deepData[key] = value;
              }
              deepScrapeSuccess = gotRegData;
              console.log(`  ├─  ✅ Deep scrape ${gotRegData ? 'successful — got regulatory data' : 'partial — no regulatory data found'}`);
            } else {
              console.log(`  ├─  ⚠️ Deep scrape returned no data`);
            }
          } catch (deepErr) {
            console.log(`  ├─  ⚠️ Deep scrape failed: ${String(deepErr).slice(0, 80)}`);
          }
        } else {
          console.log(`  ├─  ⚠️ No product URL — skipping deep scrape`);
        }

        // Step 2: Rule Engine
        console.log(`  ├─  📋 Step 2: Running rule engine validation...`);
        safeWrite('product_step', { index: i, step: 'rule_engine', message: 'Validating compliance rules...' });
        const ruleResult = validateProduct(deepData, deepScrapeSuccess);
        console.log(`  ├─  ✅ Rule engine: Score=${ruleResult.rule_score}, Violations=${ruleResult.violations.length}`);

        // Step 3: AI Analysis
        console.log(`  ├─  🤖 Step 3: Running Gemini AI analysis...`);
        safeWrite('product_step', { index: i, step: 'ai_analysis', message: 'Analyzing with Gemini AI...' });
        const aiResult = await analyzeWithGemini(deepData, deepScrapeSuccess);
        console.log(`  ├─  ✅ AI analysis: Score=${aiResult.ai_score}, Risk=${aiResult.ai_risk}`);

        // Step 4: Combine scores
        console.log(`  ├─  📊 Step 4: Combining scores...`);
        const final = combineScores(ruleResult, aiResult);
        const productTime = (Date.now() - productStart) / 1000;
        console.log(`  ├─  🏁 Final Score: ${final.score}/100, Risk: ${final.risk}`);
        console.log(`  └── Completed in ${productTime.toFixed(1)}s`);

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

        safeWrite('product_evaluated', {
          index: i,
          product: productOut,
          compliance: complianceOut,
          ai_analysis: aiOut,
          time: Math.round(productTime * 10) / 10,
        });
      } catch (productErr) {
        const productTime = (Date.now() - productStart) / 1000;
        console.log(`  ├─  ❌ Error: ${productErr.message}`);
        console.log(`  └── Failed after ${productTime.toFixed(1)}s`);

        // A database outage must not be swallowed — abort the whole stream.
        if (isDatabaseError(productErr)) throw productErr;

        safeWrite('product_error', {
          index: i,
          product_name: productNameStr,
          error: productErr.message,
        });
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

    safeWrite('complete', {
      total: scraped.length,
      time: Math.round(totalTime * 10) / 10,
    });

    safeEnd();
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

    safeWrite('error', { message });
    safeEnd();
  }
}

/**
 * POST /product/details — Scrape full product details
 */
export async function getProductDetails(req, res) {
  const productUrl = req.query.product_url || req.body?.product_url;
  const platform = req.query.platform || req.body?.platform || 'blinkit';

  if (!productUrl || !productUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid product URL' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(productUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid product URL format' });
  }

  const allowedHosts = ['blinkit.com', 'www.blinkit.com', 'zeptonow.com', 'www.zeptonow.com'];
  if (!allowedHosts.some(h => parsedUrl.hostname.toLowerCase() === h || parsedUrl.hostname.toLowerCase().endsWith('.' + h))) {
    return res.status(400).json({ error: 'Untrusted domain for product details' });
  }

  console.log(`\n🔍 Fetching product details from ${platform}: ${productUrl}`);

  try {
    let detail;
    if (platform.toLowerCase().includes('zepto') || productUrl.toLowerCase().includes('zepto')) {
      detail = await scrapeZeptoDetail(productUrl);
    } else {
      detail = await scrapeBlinkitDetail(productUrl);
    }

    console.log(`📦 Product detail fetched: ${detail ? (detail.product_name || detail.name || 'success') : 'no detail'}`);
    res.json({ status: 'success', detail });
  } catch (e) {
    console.log(`❌ Product detail fetch failed: ${e.message}`);
    res.json({ error: e.message, detail: null });
  }
}

export default { evaluateStream, getProductDetails };
