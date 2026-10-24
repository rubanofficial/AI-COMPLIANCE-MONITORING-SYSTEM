/**
 * Blinkit Product Detail Scraper — equivalent to services/scraper/blinkit_detail.py
 * Scrapes the full product detail page for compliance data.
 */
import { chromium } from 'playwright';

export async function scrapeBlinkitDetail(productUrl) {
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
    platform: 'blinkit',
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

    // Trigger lazy-load
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Product Name
    for (const sel of ['h1', '[class*="ProductName"]', '[class*="product-name"]', '[class*="productName"]']) {
      const el = await page.$(sel);
      if (el) {
        const txt = (await el.innerText()).trim();
        if (txt && txt.length > 2) { result.product_name = txt; break; }
      }
    }

    // Price — validate numerically: on variant pages the first "price-classed"
    // element can be the unit/weight picker ("500 ml", "Select Unit").
    const isNumericPrice = (t) => /^\s*₹?\s*[\d,]+(?:\.\d+)?\s*$/.test(t);
    for (const sel of ['[class*="tw-text-300"][class*="tw-font-semibold"]', '[class*="Price"] [class*="tw-font-semibold"]']) {
      const els = await page.$$(sel);
      for (const el of els) {
        const txt = (await el.innerText()).trim().replace('₹', '').trim();
        if (txt && isNumericPrice(txt)) { result.price = txt; break; }
      }
      if (result.price !== 'N/A') break;
    }
    // Fallback: first ₹-bearing text on the page that is a pure number.
    // Page text is cut at recommendation sections so prices from "similar
    // products" rails can't be mistaken for this product's price.
    if (result.price === 'N/A') {
      const pageText = await page.evaluate(() => document.body.innerText);
      const cut = pageText.search(/similar products|you might also like|frequently bought|customers also/i);
      const scoped = cut > 0 ? pageText.slice(0, cut) : pageText;
      const m = scoped.match(/₹\s*[\d,]+(?:\.\d+)?/);
      if (m) {
        const num = m[0].replace(/[₹,\s]/g, '');
        if (num) result.price = num;
      }
    }

    // MRP — must come from THIS product's buy box, not the "9 MINS" add-on
    // rail or recommendation sections, whose cards also carry strikethrough
    // prices (Banana ₹43, Davidoff ₹949, ...). Anchor at the element whose own
    // text is the selling price, then climb a bounded ancestor chain; if the
    // buy box has no strikethrough of its own, leave MRP as N/A (the listing
    // value stands).
    const mrpTxt = await page.evaluate((priceStr) => {
      const isNum = (t) => /^\s*₹?\s*[\d,]+(?:\.\d+)?\s*$/.test(t);
      const priceNum = parseFloat(String(priceStr).replace(/,/g, ''));

      // Anchor: smallest element whose own text is the selling price.
      let anchor = null;
      if (!isNaN(priceNum)) {
        for (const el of document.querySelectorAll('*')) {
          const own = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').trim();
          if (own && isNum(own) && Math.abs(parseFloat(own.replace(/[₹,]/g, '')) - priceNum) < 0.001) { anchor = el; break; }
        }
      }
      if (!anchor) return null;

      // Climb from the price anchor; the first ancestor containing a valid
      // numeric strikethrough ≥ price wins. Bail if the container grows to
      // page scale (its innerText would then span the add-on rail).
      let node = anchor;
      for (let i = 0; i < 8 && node.parentElement; i++) {
        node = node.parentElement;
        if ((node.innerText || '').length > 5000) break;
        for (const el of node.querySelectorAll('.tw-line-through, [class*="mrp"], [class*="Mrp"]')) {
          const txt = (el.innerText || '').trim().replace('₹', '').trim();
          if (!txt || !isNum(txt)) continue;
          const n = parseFloat(txt.replace(/,/g, ''));
          if (!isNaN(priceNum) && n < priceNum) continue;
          return txt;
        }
      }
      return null;
    }, result.price);
    if (mrpTxt) result.mrp = mrpTxt;

    // Discount
    for (const sel of ['[class*="tw-bg-brand-green"]', '[class*="DiscountBadge"]', '[class*="discount"]']) {
      const el = await page.$(sel);
      if (el) {
        const txt = (await el.innerText()).trim();
        if (/\d+\s*%/.test(txt)) { result.discount = txt; break; }
      }
    }

    // Product Images
    const images = await page.evaluate(() => {
      const stopTexts = ['similar products', 'you might also like', 'frequently bought', 'customers also', 'more from', 'related products'];
      let stopEl = null;
      const headings = document.querySelectorAll('h2,h3,h4,h5');
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
          if (cls.includes('similar') || cls.includes('recommendation') || cls.includes('related')) { skip = true; break; }
          p = p.parentElement;
        }
        if (skip) continue;
        const src = img.src || img.getAttribute('data-src') || '';
        if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('logo') && !src.includes('icon')) {
          if (!collected.includes(src)) collected.push(src);
        }
      }
      return collected.slice(0, 12);
    });
    result.images = images;

    // Highlights / Info key-value table
    const allKv = await page.evaluate(() => {
      const r = {};
      // Tables
      for (const table of document.querySelectorAll('table')) {
        if (table.closest('[class*="similar"]')) continue;
        for (const row of table.querySelectorAll('tr')) {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const k = (cells[0].innerText || '').trim();
            const v = cells[1].innerText.trim();
            if (k && v && k.length < 80) r[k] = v;
          }
        }
      }
      // Heading-based sections
      const targetHeadings = ['Highlights', 'Information', 'Product Details', 'Details', 'Specifications', 'About'];
      const allEls = document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div');
      for (const el of allEls) {
        const ht = (el.innerText || '').trim();
        if (!targetHeadings.includes(ht)) continue;
        let container = el.nextElementSibling || el.parentElement?.nextElementSibling;
        if (!container) continue;
        const rows = container.querySelectorAll('tr, [class*="row"], li');
        for (const row of rows) {
          const cols = Array.from(row.children).filter(c => (c.innerText || '').trim());
          if (cols.length >= 2) {
            const k = (cols[0].innerText || '').trim();
            const v = cols.slice(1).map(c => c.innerText.trim()).join(' ');
            if (k && v && k.length < 80) r[k] = v;
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
      else if (kl.includes('fssai')) result.fssai_number = vl.replace(/[^\d]/g, '').slice(0, 14) || vl;
      else if (kl.includes('ingredient')) result.ingredients = vl;
      else if (kl.includes('manufacturer') && (kl.includes('name') || kl.includes('by'))) result.manufacturer_name = vl;
      else if (kl.includes('manufacturer') && kl.includes('address')) result.manufacturer_address = vl;
      else if (kl.includes('seller')) result.seller_name = vl;
      else if (kl.includes('country') && kl.includes('origin')) result.country_of_origin = vl;
      else if (kl.includes('shelf life')) { result.shelf_life = vl; if (result.expiry_date === 'N/A') result.expiry_date = vl; }
      else if (kl.includes('expiry') || kl.includes('best before')) result.expiry_date = vl;
      else if (kl.includes('nutritional') || kl.includes('nutrition')) result.nutritional_info = vl;
      else if (kl.includes('weight') || kl.includes('net quantity')) { if (result.weight === 'N/A') result.weight = vl; }
      else if (kl.includes('category')) result.category = vl;
    }

    // FSSAI fallback — regex scan of page text
    if (result.fssai_number === 'N/A') {
      const pageText = await page.evaluate(() => document.body.innerText);
      let m = pageText.match(/FSSAI[:\s#Lic.]*([\d\s]{14,17})/i);
      if (!m) m = pageText.match(/\b\d{14}\b/);
      if (m) {
        const raw = m[0].replace(/\D/g, '');
        if (raw.length >= 14) result.fssai_number = raw.slice(0, 14);
      }
    }

    // Description
    for (const sel of ['[class*="Description"]', '[class*="description"]', '[class*="AboutProduct"]']) {
      const el = await page.$(sel);
      if (el) {
        const txt = (await el.innerText()).trim();
        if (txt && txt.length > 15) { result.description = txt.slice(0, 1500); break; }
      }
    }

    await browser.close();
    return result;
  } catch (e) {
    console.log(`    [Blinkit Detail] Error: ${e.message}`);
    try { await browser.close(); } catch { /* ignore */ }
    return result;
  }
}

export default { scrapeBlinkitDetail };
