/**
 * Blinkit Live Scraper — equivalent to services/scraper/blinkit_live.py
 * Quick scrape of Blinkit search results using Playwright.
 */
import { chromium } from 'playwright';
import { MAX_PRODUCTS } from '../../config/settings.js';

export async function scrapeBlinkitLive(productName) {
  const url = `https://www.blinkit.com/s/?q=${encodeURIComponent(productName)}`;
  console.log(`    [Blinkit] Opening ${url}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { timeout: 25000, waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.tw-line-clamp-2', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const results = await page.evaluate(({ maxProducts, searchQuery }) => {
      // Content-based validation — Blinkit's variant cards sometimes reuse the
      // price classes on the weight element (and vice versa), so selectors
      // alone are not trustworthy. Only accept values shaped like the field.
      const NUM_RE = /^\s*₹?\s*[\d,]+(?:\.\d+)?\s*$/;
      const WEIGHT_RE = /^\s*\d+(?:\.\d+)?\s*(g|kg|ml|l|ltr|litre|liter|pcs|pc|units?|nos?)\s*$/i;
      const toNumber = (t) => {
        const s = (t || '').replace(/[₹,\s]/g, '');
        return NUM_RE.test((t || '').trim()) ? s : null;
      };

      const stopWords = new Set(['in', 'the', 'of', 'and', 'with', 'for', 'a', 'an', 'to', 'from', 'at', 'by']);
      const queryTokens = (searchQuery || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1 && !stopWords.has(t));

      const nameEls = document.querySelectorAll('.tw-line-clamp-2');
      const products = [];
      for (const nameEl of nameEls) {
        if (products.length >= maxProducts) break;
        const name = nameEl.textContent.trim();
        if (!name || name.length < 3 || name.includes('Showing')) continue;

        // Walk up to the full product card
        let card = nameEl;
        for (let i = 0; i < 10; i++) {
          card = card.parentElement;
          if (!card) break;
          if (card.className && card.className.includes('tw-relative') && card.className.includes('tw-h-full')) break;
        }
        if (!card) continue;

        // Filter out obvious recommendation / add-on / sponsored rail sections
        let isExcluded = false;
        let parent = card;
        for (let p = 0; p < 8 && parent && parent !== document.body; p++) {
          const cls = (parent.className || '').toLowerCase();
          const id = (parent.id || '').toLowerCase();
          const aria = (parent.getAttribute('aria-label') || '').toLowerCase();
          if (
            cls.includes('recommend') || cls.includes('similar') || cls.includes('sponsored') || cls.includes('carousel') ||
            id.includes('recommend') || id.includes('similar') || id.includes('sponsored') ||
            aria.includes('recommend') || aria.includes('similar') || aria.includes('sponsored')
          ) {
            isExcluded = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (isExcluded) continue;

        // Relevance validation: ensure candidate shares at least one meaningful token with user search
        if (queryTokens.length > 0) {
          const nameLower = name.toLowerCase();
          const isRelevant = queryTokens.some(tok => {
            if (nameLower.includes(tok)) return true;
            if (tok.length >= 4 && nameLower.includes(tok.slice(0, 4))) return true;
            return false;
          });
          if (!isRelevant) continue;
        }

        const weightEl = card.querySelector('.tw-text-200.tw-font-medium.tw-line-clamp-1');
        const weightRaw = weightEl ? weightEl.textContent.trim() : null;
        const weight = weightRaw && WEIGHT_RE.test(weightRaw) ? weightRaw : null;

        // Selling price: prefer a numeric candidate among the semibold elements,
        // skipping anything that is the weight text or not a pure number.
        let price = null;
        for (const el of card.querySelectorAll('.tw-text-200.tw-font-semibold')) {
          const t = el.textContent.trim();
          if (weightRaw && t === weightRaw) continue;
          const num = toNumber(t);
          if (num !== null) { price = num; break; }
        }
        // Fallback: first ₹-bearing own-text node in the card that is not the MRP.
        if (price === null) {
          const mrpEl0 = card.querySelector('.tw-line-through');
          const mrpText0 = mrpEl0 ? mrpEl0.textContent.trim() : '';
          for (const el of card.querySelectorAll('*')) {
            const own = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
            if (own && own.includes('₹') && own !== mrpText0) {
              const num = toNumber(own);
              if (num !== null) { price = num; break; }
            }
          }
        }

        const mrpEl = card.querySelector('.tw-line-through');
        const mrp = mrpEl ? toNumber(mrpEl.textContent.trim()) : null;

        const discountEl = card.querySelector('.tw-absolute.tw-z-20');
        let discount = '0%';
        if (discountEl) {
          const m = discountEl.textContent.match(/(\d+\s*%)/);
          if (m) discount = m[1].replace(/\s+/g, '');
        }

        const img = card.querySelector('img');
        let imgSrc = null;
        if (img) {
          imgSrc = img.src || img.getAttribute('data-src') || null;
          if (imgSrc && imgSrc.startsWith('data:')) imgSrc = img.getAttribute('data-src');
        }

        const productId = card.getAttribute('id') || '';

        products.push({
          platform: 'blinkit',
          product_name: name,
          description: weight ? (name + ' - ' + weight) : name,
          weight,
          price,
          mrp,
          discount,
          store_name: 'Blinkit',
          product_image: imgSrc || 'https://via.placeholder.com/150',
          product_url: productId ? ('https://blinkit.com/prn/-/prid/' + productId) : '',
          product_id: productId,
        });
      }
      return products;
    }, { maxProducts: MAX_PRODUCTS, searchQuery: productName });

    console.log(`    [Blinkit] Extracted ${results.length} products`);
    await browser.close();
    return results;
  } catch (e) {
    console.log(`    [Blinkit] Scraping error: ${e.message}`);
    try { await browser.close(); } catch { /* ignore */ }
    return [];
  }
}

export default { scrapeBlinkitLive };
