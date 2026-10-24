/**
 * Zepto Live Scraper — searches Zepto for products by name.
 *
 * Strategy: Zepto uses AWS WAF bot protection that returns a 202 challenge
 * page.  The browser's JS engine solves the challenge automatically, then
 * the Next.js app makes an XHR to their internal search API at
 * `bff-gateway.zepto.com/user-search-service/api/v3/search`.
 *
 * We intercept that API response for structured JSON data instead of
 * relying on brittle DOM selectors that break whenever Zepto ships a
 * new UI version.
 */
import { chromium } from 'playwright';
import { MAX_PRODUCTS } from '../../config/settings.js';

/** Zepto prices are integers in paisa — convert to rupee string. */
function formatPrice(paisa) {
  if (paisa == null || paisa === 0) return null;
  return (paisa / 100).toFixed(0);
}

/** Build a full CDN image URL from the relative path Zepto returns. */
function imageUrl(path) {
  if (!path) return 'https://via.placeholder.com/150';
  if (path.startsWith('http')) return path;
  return `https://cdn.zeptonow.com/production/${path}`;
}

/**
 * Create a stealth browser context with anti-detection measures.
 * Shared between the live and detail scrapers.
 */
async function createStealthContext(browser) {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9',
      'sec-ch-ua':
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
  });

  // Remove automation fingerprints
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-IN', 'en-US', 'en'],
    });
    window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
  });

  return context;
}

export async function scrapeZeptoLive(productName) {
  const url = `https://www.zeptonow.com/search?query=${encodeURIComponent(productName)}`;
  console.log(`    [Zepto] Opening ${url}`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    // Set up API response interception BEFORE navigation
    let searchApiData = null;
    page.on('response', async (resp) => {
      try {
        const respUrl = resp.url();
        if (
          respUrl.includes('user-search-service/api/v3/search') &&
          !respUrl.includes('filters') &&
          resp.status() === 200
        ) {
          searchApiData = await resp.json();
        }
      } catch { /* ignore deserialization errors */ }
    });

    // Navigate — the initial response is a WAF challenge (202)
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });

    // Wait for the real search API call that fires after WAF challenge is solved
    try {
      await page.waitForResponse(
        (resp) =>
          resp.url().includes('user-search-service/api/v3/search') &&
          !resp.url().includes('filters'),
        { timeout: 20000 },
      );
    } catch {
      // Timeout — the API may not have fired (page fully blocked)
      console.log('    [Zepto] Timed out waiting for search API response');
    }

    // Brief pause to let the response handler finish parsing
    await page.waitForTimeout(1000);

    const results = [];

    if (searchApiData) {
      // ──── PRIMARY PATH: extract from API JSON ────
      const layout = searchApiData.layout || [];

      for (const widget of layout) {
        const items = widget.data?.resolver?.data?.items || [];
        for (const item of items) {
          const pr = item.productResponse || item;
          const product = pr.product || {};
          const variant = pr.productVariant || {};

          const name = product.name;
          if (!name) continue;

          // Price is in paisa (integer cents)
          const price = formatPrice(pr.sellingPrice ?? pr.discountedSellingPrice);
          const mrp = formatPrice(pr.mrp ?? variant.mrp);

          // Discount
          let discount = '0%';
          if (pr.discountPercent) {
            discount = `${pr.discountPercent}%`;
          }

          // Weight / pack size
          const weight = variant.formattedPacksize || 'N/A';

          // Product image
          const firstImage = (variant.images || [])[0];
          const productImage = firstImage
            ? imageUrl(firstImage.path)
            : 'https://via.placeholder.com/150';

          // Build product URL from the product ID
          const productId = pr.id || pr.objectId || '';
          const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          const productUrl = productId
            ? `https://www.zeptonow.com/pn/${slug}/pvid/${variant.id || productId}`
            : '';

          results.push({
            platform: 'zepto',
            product_name: name,
            description: weight !== 'N/A' ? `${name} - ${weight}` : name,
            weight,
            price,
            mrp,
            discount,
            store_name: 'Zepto',
            product_image: productImage,
            product_url: productUrl,
          });

          if (results.length >= MAX_PRODUCTS) break;
        }
        if (results.length >= MAX_PRODUCTS) break;
      }

      console.log(`    [Zepto] Extracted ${results.length} products from API`);
    } else {
      // ──── FALLBACK: DOM-based extraction ────
      console.log('    [Zepto] API interception missed — falling back to DOM');
      await page.waitForTimeout(3000);

      const domResults = await extractFromDOM(page);
      results.push(...domResults.slice(0, MAX_PRODUCTS));
      console.log(`    [Zepto] Extracted ${results.length} products from DOM`);
    }

    await browser.close();
    return results.slice(0, MAX_PRODUCTS);
  } catch (e) {
    console.log(`    [Zepto] Scraping error: ${e.message}`);
    try { await browser.close(); } catch { /* ignore */ }
    return [];
  }
}

/**
 * DOM-based fallback extractor — kept for resilience when the API
 * interception fails (e.g. Zepto changes their API endpoint).
 */
async function extractFromDOM(page) {
  const productCandidates = await page.$$('a[href*="/pn/"]');
  const results = [];

  for (const product of productCandidates.slice(0, 20)) {
    try {
      const nameEl = await product.$('[data-slot-id="ProductName"]');
      const name = nameEl ? await nameEl.innerText() : null;
      if (!name) continue;

      const priceEl = await product.$('[data-slot-id="EdlpPrice"] span:nth-of-type(1)');
      let price = priceEl ? await priceEl.innerText() : null;

      const mrpEl = await product.$('[data-slot-id="EdlpPrice"] span:nth-of-type(2)');
      let mrp = mrpEl ? await mrpEl.innerText() : null;

      // Discount parsing
      let discount = '0% OFF';
      const allText = await product.innerText();
      const match = allText.match(/(\d+%\s*OFF)/i);
      if (match) discount = match[1];

      if (price) price = price.replace('₹', '').trim();
      if (mrp) mrp = mrp.replace('₹', '').trim();
      if (discount.includes('OFF')) discount = discount.toUpperCase().replace('OFF', '').trim();

      // Extract product image
      const imgEl = await product.$('img');
      let productImage = imgEl ? await imgEl.getAttribute('src') : null;
      if (!productImage || productImage.startsWith('data:')) {
        productImage = imgEl ? await imgEl.getAttribute('data-src') : null;
      }
      productImage = productImage || 'https://via.placeholder.com/150';

      // Product URL
      const href = (await product.getAttribute('href')) || '';
      const productUrl = href.startsWith('/') ? `https://www.zeptonow.com${href}` : href;

      // Pack size / weight
      let weight = 'N/A';
      try {
        const packEl = await product.$(
          '[data-slot-id="ProductPackSize"], [data-slot-id*="pack" i], [class*="packSize" i], [class*="pack-size" i], [class*="quantity" i]',
        );
        if (packEl) {
          const pt = (await packEl.innerText()).trim();
          if (pt && pt !== 'N/A' && pt !== 'null') weight = pt;
        }
      } catch { /* ignore */ }

      if (weight === 'N/A') {
        const MULTI_PACK_RE =
          /\b(\d+\s*x\s*\d+(?:\.\d+)?\s*(?:kg|kilo|g|gm|gms|gram|grams|l|ltr|litre|liter|ml|pcs|pc|units?|nos?|sachets?|bags?))\b/i;
        const WEIGHT_RE =
          /\b(\d+(?:\.\d+)?\s*(?:kg|kilo|g|gm|gms|gram|grams|l|ltr|litre|liter|ml|pcs|pc|units?|nos?|sachets?|bags?))\b/i;
        const multiMatch =
          name.match(MULTI_PACK_RE) || (allText && allText.match(MULTI_PACK_RE));
        if (multiMatch) {
          weight = multiMatch[1].trim();
        } else {
          const singleMatch =
            name.match(WEIGHT_RE) || (allText && allText.match(WEIGHT_RE));
          if (singleMatch) {
            weight = singleMatch[1].trim();
          }
        }
      }

      results.push({
        platform: 'zepto',
        product_name: name,
        description: weight !== 'N/A' ? `${name} - ${weight}` : name,
        weight,
        price,
        mrp,
        discount,
        store_name: 'Zepto',
        product_image: productImage,
        product_url: productUrl || '',
      });
    } catch {
      continue;
    }
  }

  return results;
}

export { createStealthContext };
export default { scrapeZeptoLive };
