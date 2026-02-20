import asyncio
import sys
from playwright.async_api import async_playwright
from config.settings import MAX_PRODUCTS

async def scrape_zepto_live(product_name):

    
    url = f"https://www.zeptonow.com/search?query={product_name}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        try:
            await page.goto(url, timeout=20000)

            await page.wait_for_selector('a[href*="/pn/"]', timeout=10000)

            product_candidates = await page.query_selector_all('a[href*="/pn/"]')

            results = []

            import re
            for product in product_candidates[:20]:
                try:
                    name_el = await product.query_selector('[data-slot-id="ProductName"]')
                    name = await name_el.inner_text() if name_el else None
                    if not name:
                        continue

                    # Price is usually the first span in EdlpPrice
                    price_el = await product.query_selector('[data-slot-id="EdlpPrice"] span:nth-of-type(1)')
                    price = await price_el.inner_text() if price_el else None
                    
                    # MRP is the second span
                    mrp_el = await product.query_selector('[data-slot-id="EdlpPrice"] span:nth-of-type(2)')
                    mrp = await mrp_el.inner_text() if mrp_el else None

                    # Discount parsing
                    discount = "0% OFF"
                    all_text = await product.inner_text()
                    match = re.search(r"(\d+%\s*OFF)", all_text, re.IGNORECASE)
                    if match:
                        discount = match.group(1)
                    
                    if price:
                        price = price.replace("₹", "").strip()
                    if mrp:
                        mrp = mrp.replace("₹", "").strip()
                    if "OFF" in discount:
                        discount = discount.upper().replace("OFF", "").strip()

                    # Extract real product image
                    img_el = await product.query_selector("img")
                    product_image = await img_el.get_attribute("src") if img_el else None
                    if not product_image or product_image.startswith("data:"):
                        product_image = await img_el.get_attribute("data-src") if img_el else None
                    product_image = product_image or "https://via.placeholder.com/150"

                    results.append({
                        "platform": "zepto",
                        "product_name": name,
                        "description": name,
                        "weight": "N/A",
                        "price": price,
                        "mrp": mrp,
                        "discount": discount,
                        "store_name": "Zepto",
                        "product_image": product_image
                    })
                except Exception:
                    continue

            await browser.close()
            return results

        except Exception as e:
            import traceback
            # Capture HTML for debugging
            try:
                content = await page.content()
                with open("zepto_debug.html", "w", encoding="utf-8") as f:
                    f.write(content)
            except:
                pass

            with open("scraper_error.log", "a") as f:
                f.write(f"Zepto Error for {product_name}:\n")
                f.write(traceback.format_exc())
                f.write("\n" + "="*50 + "\n")
            await browser.close()
            return []
