/**
 * Zepto Live Scraper — equivalent to services/scraper/zepto_live.py
 * Quick scrape of Zepto search results using Playwright.
 */
const { MAX_PRODUCTS } = require('../../config/settings');

async function scrapeZeptoLive(productName) {
  const { chromium } = require('playwright');
  const url = `https://www.zeptonow.com/search?query=${encodeURIComponent(productName)}`;

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { timeout: 20000 });
    await page.waitForSelector('a[href*="/pn/"]', { timeout: 10000 });

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

        // Zepto product cards are <a href="/pn/..."> elements
        const href = await product.getAttribute('href') || '';
        const productUrl = href.startsWith('/') ? `https://www.zeptonow.com${href}` : href;

        results.push({
          platform: 'zepto',
          product_name: name,
          description: name,
          weight: 'N/A',
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

    // Limit to MAX_PRODUCTS
    await browser.close();
    return results.slice(0, MAX_PRODUCTS);
  } catch (e) {
    console.log(`    [Zepto] Scraping error: ${e.message}`);
    try { await browser.close(); } catch { /* ignore */ }
    return [];
  }
}

module.exports = { scrapeZeptoLive };
