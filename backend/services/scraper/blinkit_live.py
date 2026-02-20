import asyncio
import sys
from playwright.async_api import async_playwright
from config.settings import MAX_PRODUCTS

async def scrape_blinkit_live(product_name):

    
    url = f"https://www.blinkit.com/s/?q={product_name}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        try:
            await page.goto(url, timeout=20000)

            await page.wait_for_selector('div[role="button"]', timeout=10000)

            product_candidates = await page.query_selector_all('div[role="button"]')

            results = []
            
            for product in product_candidates[:20]:
                try:
                    name_el = await product.query_selector(".tw-line-clamp-2")
                    if not name_el:
                         continue
                         
                    name = await name_el.inner_text()

                    weight_el = await product.query_selector(".tw-text-200.tw-font-medium.tw-line-clamp-1")
                    weight = await weight_el.inner_text() if weight_el else None

                    price_el = await product.query_selector(".tw-text-200.tw-font-semibold")
                    price = await price_el.inner_text() if price_el else None
                    if price:
                        price = price.replace("₹", "").strip()

                    mrp_el = await product.query_selector(".tw-line-through")
                    mrp = await mrp_el.inner_text() if mrp_el else None
                    if mrp:
                        mrp = mrp.replace("₹", "").strip()

                    discount = "0% OFF"
                    discount_el = await product.query_selector(".tw-absolute.tw-z-20")
                    if discount_el:
                        discount = await discount_el.inner_text()
                    if "OFF" in discount:
                         discount = discount.replace("OFF", "").strip()

                    # Extract real product image
                    img_el = await product.query_selector("img")
                    product_image = await img_el.get_attribute("src") if img_el else None
                    if not product_image or product_image.startswith("data:"):
                        product_image = await img_el.get_attribute("data-src") if img_el else None
                    product_image = product_image or "https://via.placeholder.com/150"

                    # Try to find the product detail URL via nearest ancestor <a>
                    product_url = await product.evaluate(
                        "el => { const a = el.closest('a'); return a ? a.href : null; }"
                    )
                    if not product_url:
                        # Fallback: try sibling/parent anchor
                        product_url = await page.evaluate(
                            """(el) => {
                                let node = el;
                                for (let i = 0; i < 6; i++) {
                                    if (!node.parentElement) break;
                                    node = node.parentElement;
                                    if (node.tagName === 'A' && node.href) return node.href;
                                }
                                return null;
                            }""",
                            product
                        )

                    results.append({
                        "platform": "blinkit",
                        "product_name": name,
                        "description": f"{name} - {weight}" if weight else name,
                        "weight": weight,
                        "price": price,
                        "mrp": mrp,
                        "discount": discount,
                        "store_name": "Blinkit",
                        "product_image": product_image,
                        "product_url": product_url or ""
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
