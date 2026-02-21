import asyncio
import sys
from playwright.async_api import async_playwright
from config.settings import MAX_PRODUCTS

async def scrape_blinkit_live(product_name):
    """
    Scrape Blinkit search results using JS-based extraction.
    The product card is a div.tw-relative.tw-h-full containing the name
    inside .tw-line-clamp-2 (multiple levels deep).
    """
    url = f"https://www.blinkit.com/s/?q={product_name}"
    print(f"    [Blinkit] Opening {url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        try:
            await page.goto(url, timeout=20000)
            await page.wait_for_selector('.tw-line-clamp-2', timeout=12000)
            await page.wait_for_timeout(2000)

            # Extract products using JS — walk from name to full card
            results = await page.evaluate(r'''(maxProducts) => {
                const nameEls = document.querySelectorAll('.tw-line-clamp-2');
                const products = [];
                for (const nameEl of nameEls) {
                    if (products.length >= maxProducts) break;
                    const name = nameEl.textContent.trim();
                    if (!name || name.length < 3 || name.includes('Showing')) continue;

                    // Walk up to the full product card (div.tw-relative.tw-h-full)
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
                        weight: weight,
                        price: price,
                        mrp: mrp,
                        discount: discount,
                        store_name: 'Blinkit',
                        product_image: imgSrc || 'https://via.placeholder.com/150',
                        product_url: productId ? ('https://blinkit.com/prn/-/prid/' + productId) : '',
                        product_id: productId
                    });
                }
                return products;
            }''', MAX_PRODUCTS)

            print(f"    [Blinkit] Extracted {len(results)} products")
            await browser.close()
            return results

        except Exception as e:
            import traceback
            print(f"    [Blinkit] Scraping error: {e}")
            try:
                content = await page.content()
                with open("blinkit_debug.html", "w", encoding="utf-8") as f:
                    f.write(content)
            except:
                pass
            with open("scraper_error.log", "a") as f:
                f.write(f"Blinkit Error for {product_name}:\n")
                f.write(traceback.format_exc())
                f.write("\n" + "="*50 + "\n")
            await browser.close()
            return []
