/**
 * Zepto Product Detail Scraper — scrapes a single Zepto product page
 * for full compliance data.
 *
 * Strategy: Like the live scraper, Zepto's product pages are protected
 * by AWS WAF and rendered client-side via Next.js.  We use two
 * complementary extraction methods:
 *
 *   1. **API interception** — capture the BFF gateway response for the
 *      product page data (contains structured JSON with FSSAI, brand,
 *      manufacturer, ingredients, etc.).
 *   2. **DOM fallback** — if the API call is not intercepted, fall back
 *      to the original DOM-based extraction from Highlights / Information
 *      sections.
 */
import { chromium } from 'playwright';

/** Zepto prices are integers in paisa — convert to rupee string. */
function formatPrice(paisa) {
  if (paisa == null || paisa === 0) return null;
  return (paisa / 100).toFixed(0);
}

/** Build a full CDN image URL from the relative path Zepto returns. */
function imageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://cdn.zeptonow.com/production/${path}`;
}

export async function scrapeZeptoDetail(productUrl) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

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

  // Anti-detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-IN', 'en-US', 'en'],
    });
    window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
  });

  const page = await context.newPage();

  const result = {
    platform: 'zepto',
    product_url: productUrl,
    product_name: 'N/A',
    brand: 'N/A',
    price: 'N/A',
    mrp: 'N/A',
    discount: 'N/A',
    weight: 'N/A',
    description: 'N/A',
    images: [],
    highlights: {},
    ingredients: 'N/A',
    nutritional_info: 'N/A',
    fssai_number: 'N/A',
    manufacturer_name: 'N/A',
    manufacturer_address: 'N/A',
    country_of_origin: 'N/A',
    expiry_date: 'N/A',
    shelf_life: 'N/A',
    seller_name: 'N/A',
    category: 'N/A',
  };

  try {
    // ──── Set up API interception ────
    let productApiData = null;
    page.on('response', async (resp) => {
      try {
        const url = resp.url();
        // Capture product-related API responses from the BFF gateway
        if (
          (url.includes('bff-gateway.zepto.com') || url.includes('zeptonow.com')) &&
          (url.includes('/product') || url.includes('/pdp') || url.includes('/lms/api')) &&
          resp.status() === 200
        ) {
          const ct = resp.headers()['content-type'] || '';
          if (ct.includes('json')) {
            const body = await resp.json();
            // Only capture if it looks like a product response
            if (body?.product || body?.productResponse || body?.layout) {
              productApiData = body;
            }
          }
        }
      } catch { /* ignore */ }
    });

    await page.goto(productUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });

    // Wait for WAF challenge to resolve and content to load
    await page.waitForTimeout(5000);

    // Scroll to trigger lazy-load
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // ──── Try extracting from __next_f data embedded in script tags ────
    let extractedFromScripts = false;
    try {
      const scriptData = await page.evaluate(() => {
        // Zepto embeds product data in self.__next_f.push() calls
        const scripts = document.querySelectorAll('script');
        const chunks = [];
        for (const s of scripts) {
          const text = s.textContent || '';
          if (text.includes('self.__next_f.push')) {
            chunks.push(text);
          }
        }
        return chunks.join('\n');
      });

      if (scriptData) {
        // Extract JSON objects that contain product data
        const productPatterns = [
          /"fssaiLicense"\s*:\s*"([^"]+)"/,
          /"manufacturerName"\s*:\s*"([^"]+)"/,
          /"manufacturerAddress"\s*:\s*"([^"]+)"/,
          /"countryOfOrigin"\s*:\s*"([^"]+)"/,
          /"brand"\s*:\s*"([^"]+)"/,
          /"ingredients"\s*:\s*"([^"]+)"/,
        ];

        // Try to find and parse product JSON blob from the Next.js data
        const jsonMatches = scriptData.match(/\{"product"\s*:\s*\{[^}]*"name"\s*:\s*"[^"]+"/g);
        if (jsonMatches) {
          // Find the larger JSON object containing the product
          for (const jsonStart of jsonMatches) {
            try {
              // Try to extract a balanced JSON object
              const startIdx = scriptData.indexOf(jsonStart);
              if (startIdx === -1) continue;
              
              // Walk forward to find a balanced object
              let depth = 0;
              let endIdx = startIdx;
              for (let i = startIdx; i < Math.min(startIdx + 50000, scriptData.length); i++) {
                if (scriptData[i] === '{') depth++;
                else if (scriptData[i] === '}') {
                  depth--;
                  if (depth === 0) { endIdx = i + 1; break; }
                }
              }
              
              if (endIdx > startIdx) {
                const candidate = scriptData.slice(startIdx, endIdx);
                const parsed = JSON.parse(candidate);
                if (parsed.product?.name) {
                  productApiData = { product: parsed.product, productVariant: parsed.productVariant };
                  extractedFromScripts = true;
                  break;
                }
              }
            } catch { /* ignore parse errors */ }
          }
        }

        // Regex fallback for individual fields
        for (const [pattern, field] of [
          [/"fssaiLicense"\s*:\s*"([^"]+)"/, 'fssai_number'],
          [/"manufacturerName"\s*:\s*"([^"]+)"/, 'manufacturer_name'],
          [/"manufacturerAddress"\s*:\s*"([^"]+)"/, 'manufacturer_address'],
          [/"countryOfOrigin"\s*:\s*"([^"]+)"/, 'country_of_origin'],
          [/"brand"\s*:\s*"([^"]+)"/, 'brand'],
          [/"shelfLifeInHours"\s*:\s*"?(\d+)"?/, 'shelf_life'],
        ]) {
          if (result[field] === 'N/A') {
            const m = scriptData.match(pattern);
            if (m) {
              let val = m[1].trim();
              if (field === 'shelf_life' && !isNaN(val)) {
                const hours = parseInt(val, 10);
                val = hours >= 720 ? `${Math.round(hours / 720)} months` :
                      hours >= 24  ? `${Math.round(hours / 24)} days`   :
                      `${hours} hours`;
              }
              result[field] = val;
            }
          }
        }

        // Extract product name from script data
        if (result.product_name === 'N/A') {
          const nameMatch = scriptData.match(/"name"\s*:\s*"([^"]{3,200})"/);
          if (nameMatch) result.product_name = nameMatch[1];
        }
      }
    } catch (e) {
      console.log(`    [Zepto Detail] Script extraction error: ${e.message}`);
    }

    // ──── DOM-based extraction (primary + fallback) ────

    // Product Name
    if (result.product_name === 'N/A') {
      for (const sel of ['h1', '[class*="product-name"]', '[class*="productName"]', '[class*="ProductName"]']) {
        const el = await page.$(sel);
        if (el) {
          const txt = (await el.innerText()).trim();
          if (txt && txt.length > 2) { result.product_name = txt; break; }
        }
      }
    }

    // Price
    if (result.price === 'N/A') {
      for (const sel of ['[class*="price"] [class*="selling"]', '[class*="offerPrice"]', '[class*="selling-price"]']) {
        const el = await page.$(sel);
        if (el) {
          const txt = (await el.innerText()).trim().replace('₹', '').trim();
          if (txt && txt !== 'N/A') { result.price = txt; break; }
        }
      }
    }

    // MRP
    if (result.mrp === 'N/A') {
      for (const sel of ['[class*="mrp"]', '[class*="MRP"]', '[class*="originalPrice"]', 's']) {
        const el = await page.$(sel);
        if (el) {
          const txt = (await el.innerText()).trim().replace('₹', '').trim();
          if (txt && txt !== result.price) { result.mrp = txt; break; }
        }
      }
    }

    // Discount
    if (result.discount === 'N/A') {
      for (const sel of ['[class*="discount"]', '[class*="Discount"]', '[class*="offer"]']) {
        const el = await page.$(sel);
        if (el) {
          const txt = (await el.innerText()).trim();
          if (/\d+\s*%/.test(txt)) { result.discount = txt; break; }
        }
      }
    }

    // Product Images — only from gallery
    if (result.images.length === 0) {
      const images = await page.evaluate(() => {
        const stopTexts = ['similar products', 'you might also like', 'frequently bought', 'customers also', 'explore more'];
        let stopEl = null;
        const headings = document.querySelectorAll('h2,h3,h4');
        for (const h of headings) {
          const ht = (h.innerText || '').toLowerCase();
          if (stopTexts.some(s => ht.includes(s))) {
            stopEl = h.closest('section, div[class]') || h.parentElement;
            break;
          }
        }
        const collected = [];
        for (const img of document.querySelectorAll('img')) {
          if (stopEl && stopEl.contains(img)) break;
          let skip = false;
          let p = img.parentElement;
          for (let i = 0; i < 8 && p; i++) {
            const cls = (p.className || '').toLowerCase();
            if (cls.includes('similar') || cls.includes('recommendation') || cls.includes('explore')) { skip = true; break; }
            p = p.parentElement;
          }
          if (skip) continue;
          const src = img.src || img.getAttribute('data-src') || '';
          if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('logo') && !src.includes('icon') && !src.includes('banner')) {
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if ((w > 0 && w < 50) || (h > 0 && h < 50)) continue;
            if (!collected.includes(src)) collected.push(src);
          }
        }
        return collected.slice(0, 12);
      });
      result.images = images;
    }

    // Highlights + Information tables
    const allKv = await page.evaluate(() => {
      const r = {};
      const allHeadings = document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div');
      for (const heading of allHeadings) {
        const ht = (heading.innerText || '').trim();
        if (!['Highlights', 'Information'].includes(ht)) continue;
        let container = heading.nextElementSibling || heading.parentElement?.nextElementSibling;
        if (!container) container = heading.closest('[class*="section"], div[class]');
        if (!container) continue;
        // Extract rows
        const rows = container.querySelectorAll('[class*="row"], [class*="Row"], tr, li');
        for (const row of rows) {
          const children = Array.from(row.children).filter(c => (c.innerText || '').trim());
          if (children.length >= 2) {
            const k = (children[0].innerText || '').trim();
            const v = children.slice(1).map(c => (c.innerText || '').trim()).join(' ');
            if (k && v && k.length < 80) r[k] = v;
          }
        }
        // Fallback: text with ':' separators
        if (Object.keys(r).length === 0) {
          const text = container.innerText || '';
          for (const line of text.split('\n').filter(Boolean)) {
            if (line.includes(':')) {
              const idx = line.indexOf(':');
              const k = line.slice(0, idx).trim();
              const v = line.slice(idx + 1).trim();
              if (k && v && k.length < 80) r[k] = v;
            }
          }
        }
      }
      return r;
    });

    if (allKv) result.highlights = allKv;

    // Map k/v into structured fields (only if not already set)
    for (const [k, v] of Object.entries(allKv)) {
      const kl = k.toLowerCase().trim();
      const vl = String(v).trim();
      if (!vl || vl === 'N/A') continue;
      if (kl.includes('brand') && result.brand === 'N/A') result.brand = vl;
      else if (kl.includes('product type')) { if (result.category === 'N/A') result.category = vl; }
      else if (kl.includes('fssai') && result.fssai_number === 'N/A') result.fssai_number = vl;
      else if (kl.includes('ingredient') && result.ingredients === 'N/A') result.ingredients = vl;
      else if (kl.includes('manufacturer') && (kl.includes('name') || kl.includes('by')) && result.manufacturer_name === 'N/A') result.manufacturer_name = vl;
      else if (kl.includes('manufacturer') && kl.includes('address') && result.manufacturer_address === 'N/A') result.manufacturer_address = vl;
      else if (kl.includes('seller') && result.seller_name === 'N/A') result.seller_name = vl;
      else if (kl.includes('country') && kl.includes('origin') && result.country_of_origin === 'N/A') result.country_of_origin = vl;
      else if (kl.includes('shelf life') && result.shelf_life === 'N/A') { result.shelf_life = vl; if (result.expiry_date === 'N/A') result.expiry_date = vl; }
      else if ((kl.includes('expiry') || kl.includes('best before')) && result.expiry_date === 'N/A') result.expiry_date = vl;
      else if ((kl.includes('nutritional') || kl.includes('nutrition')) && result.nutritional_info === 'N/A') result.nutritional_info = vl;
      else if ((kl.includes('weight') || kl.includes('net quantity')) && result.weight === 'N/A') result.weight = vl;
      else if (kl.includes('unit') && result.weight === 'N/A') result.weight = vl;
    }

    // FSSAI fallback from page text
    if (result.fssai_number === 'N/A') {
      const pageText = await page.evaluate(() => document.body.innerText);
      let m = pageText.match(/\bFSSAI[:\s#]*([\d\s]{14,17})/i);
      if (!m) m = pageText.match(/\b\d{14}\b/);
      if (m) {
        const raw = m[0].replace(/\D/g, '');
        if (raw.length >= 14) result.fssai_number = raw.slice(0, 14);
      }
    }

    // Description
    if (result.description === 'N/A') {
      for (const sel of ['[class*="description"]', '[class*="Description"]', '[class*="about"]']) {
        const el = await page.$(sel);
        if (el) {
          const txt = (await el.innerText()).trim();
          if (txt && txt.length > 15) { result.description = txt.slice(0, 1500); break; }
        }
      }
    }

    await browser.close();
    return result;
  } catch (e) {
    console.log(`    [Zepto Detail] Error: ${e.message}`);
    try { await browser.close(); } catch { /* ignore */ }
    return result;
  }
}

export default { scrapeZeptoDetail };
