/**
 * Zepto Product Detail Scraper — equivalent to services/scraper/zepto_detail.py
 * Scrapes the product detail page for compliance data.
 */
async function scrapeZeptoDetail(productUrl) {
  const { chromium } = require('playwright');

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
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
    await page.goto(productUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy-load
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Product Name
    for (const sel of ['h1', '[class*="product-name"]', '[class*="productName"]', '[class*="ProductName"]']) {
      const el = await page.$(sel);
      if (el) {
        const txt = (await el.innerText()).trim();
        if (txt && txt.length > 2) { result.product_name = txt; break; }
      }
    }

    // Price
    for (const sel of ['[class*="price"] [class*="selling"]', '[class*="offerPrice"]', '[class*="selling-price"]']) {
      const el = await page.$(sel);
      if (el) {
        const txt = (await el.innerText()).trim().replace('₹', '').trim();
        if (txt && txt !== 'N/A') { result.price = txt; break; }
      }
    }

    // MRP
    for (const sel of ['[class*="mrp"]', '[class*="MRP"]', '[class*="originalPrice"]', 's']) {
      const el = await page.$(sel);
      if (el) {
        const txt = (await el.innerText()).trim().replace('₹', '').trim();
        if (txt && txt !== result.price) { result.mrp = txt; break; }
      }
    }

    // Discount
    for (const sel of ['[class*="discount"]', '[class*="Discount"]', '[class*="offer"]']) {
      const el = await page.$(sel);
      if (el) {
        const txt = (await el.innerText()).trim();
        if (/\d+\s*%/.test(txt)) { result.discount = txt; break; }
      }
    }

    // Product Images — only from gallery
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

    // Map k/v into structured fields
    for (const [k, v] of Object.entries(allKv)) {
      const kl = k.toLowerCase().trim();
      const vl = String(v).trim();
      if (!vl || vl === 'N/A') continue;
      if (kl.includes('brand')) result.brand = vl;
      else if (kl.includes('product type')) { if (result.category === 'N/A') result.category = vl; }
      else if (kl.includes('fssai')) result.fssai_number = vl;
      else if (kl.includes('ingredient')) result.ingredients = vl;
      else if (kl.includes('manufacturer') && (kl.includes('name') || kl.includes('by'))) result.manufacturer_name = vl;
      else if (kl.includes('manufacturer') && kl.includes('address')) result.manufacturer_address = vl;
      else if (kl.includes('seller')) result.seller_name = vl;
      else if (kl.includes('country') && kl.includes('origin')) result.country_of_origin = vl;
      else if (kl.includes('shelf life')) { result.shelf_life = vl; if (result.expiry_date === 'N/A') result.expiry_date = vl; }
      else if (kl.includes('expiry') || kl.includes('best before')) result.expiry_date = vl;
      else if (kl.includes('nutritional') || kl.includes('nutrition')) result.nutritional_info = vl;
      else if (kl.includes('weight') || kl.includes('net quantity')) { if (result.weight === 'N/A') result.weight = vl; }
      else if (kl.includes('unit') && result.weight === 'N/A') result.weight = vl;
    }

    // FSSAI fallback
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
    for (const sel of ['[class*="description"]', '[class*="Description"]', '[class*="about"]']) {
      const el = await page.$(sel);
      if (el) {
        const txt = (await el.innerText()).trim();
        if (txt && txt.length > 15) { result.description = txt.slice(0, 1500); break; }
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

module.exports = { scrapeZeptoDetail };
