/**
 * Blinkit Live Scraper — equivalent to services/scraper/blinkit_live.py
 * Quick scrape of Blinkit search results using Playwright.
 */
const { MAX_PRODUCTS } = require('../../config/settings');

async function scrapeBlinkitLive(productName) {
  const { chromium } = require('playwright');
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

    const results = await page.evaluate((maxProducts) => {
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

        const weightEl = card.querySelector('.tw-text-200.tw-font-medium.tw-line-clamp-1');
        const weight = weightEl ? weightEl.textContent.trim() : null;

        const priceEl = card.querySelector('.tw-text-200.tw-font-semibold');
        let price = priceEl ? priceEl.textContent.trim().replace('\u20B9', '').trim() : null;

        const mrpEl = card.querySelector('.tw-line-through');
        let mrp = mrpEl ? mrpEl.textContent.trim().replace('\u20B9', '').trim() : null;

        const discountEl = card.querySelector('.tw-absolute.tw-z-20');
        let discount = '0%';
        if (discountEl) discount = discountEl.textContent.trim().replace('OFF', '').trim();

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
    }, MAX_PRODUCTS);

    console.log(`    [Blinkit] Extracted ${results.length} products`);
    await browser.close();
    return results;
  } catch (e) {
    console.log(`    [Blinkit] Scraping error: ${e.message}`);
    try { await browser.close(); } catch { /* ignore */ }
    return [];
  }
}

module.exports = { scrapeBlinkitLive };
