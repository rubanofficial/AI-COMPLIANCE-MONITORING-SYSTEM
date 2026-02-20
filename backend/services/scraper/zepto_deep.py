from playwright.async_api import async_playwright
import re
import json
import asyncio


async def scrape_zepto_deep(query: str, is_direct_url: bool = False):
    """
    Robust Zepto scraper with proper location handling.
    1. Handles location selection
    2. Searches for products OR navigates to direct URL
    3. Visits each product page to extract compliance data + images
    """

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
        )

        page = await context.new_page()

        async def set_zepto_location():
            """Handle Zepto location selection."""
            try:
                location_btn = await page.query_selector(
                    'button:has-text("Select Location"), '
                    'button:has-text("Change Location"), '
                    '[data-testid*="location"]'
                )
                if location_btn:
                    await location_btn.click()
                    await page.wait_for_timeout(2000)

                location_input = await page.query_selector(
                    'input[placeholder*="location"], '
                    'input[placeholder*="area"], '
                    'input[placeholder*="search"]'
                )
                if location_input:
                    print("  Setting location to Gurugram...")
                    await location_input.fill("Gurugram")
                    await page.wait_for_timeout(3000)
                    await page.keyboard.press("ArrowDown")
                    await page.keyboard.press("Enter")
                    await page.wait_for_timeout(5000)
            except Exception as e:
                print(f"  Warning: Location handling: {str(e)[:100]}")

        try:
            # -- Direct URL mode --
            if is_direct_url:
                print(f"\n  Zepto: Direct product URL")
                print(f"  URL: {query}")
                await page.goto(query, timeout=30000, wait_until="domcontentloaded")
                await page.wait_for_timeout(3000)

                # Check if location prompt blocks content
                try:
                    await page.wait_for_selector('h1', timeout=5000)
                except:
                    await set_zepto_location()
                    await page.goto(query, timeout=30000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)

                product = await _extract_zepto_product(page, query)
                await browser.close()
                return [product] if product else []

            # -- Search mode --
            print(f"\n  Zepto: Searching for '{query}'")

            # Step 1: Go to Zepto homepage first to set location
            print("  Setting delivery location first...")
            await page.goto("https://www.zeptonow.com", timeout=30000, wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            await set_zepto_location()

            # Step 2: Navigate to search
            search_url = f"https://www.zeptonow.com/search?query={query}"
            print(f"  Navigating to search: {search_url}")
            await page.goto(search_url, timeout=30000, wait_until="domcontentloaded")
            await page.wait_for_timeout(5000)

            # Step 3: Wait for product links
            try:
                await page.wait_for_selector('a[href*="/pn/"]', timeout=10000)
            except:
                print("  No products found immediately, retrying with location...")
                await set_zepto_location()
                await page.goto(search_url, timeout=30000, wait_until="domcontentloaded")
                await page.wait_for_timeout(5000)
                try:
                    await page.wait_for_selector('a[href*="/pn/"]', timeout=10000)
                except:
                    # Save debug HTML
                    html = await page.content()
                    with open("zepto_debug_search.html", "w", encoding="utf-8") as f:
                        f.write(html)
                    print("  No products found. Debug HTML saved to zepto_debug_search.html")
                    await browser.close()
                    return []

            # Step 4: Extract product URLs
            print("  Extracting product links...")
            product_links = await page.query_selector_all('a[href*="/pn/"]')
            product_urls = []

            for link in product_links[:5]:
                href = await link.get_attribute('href')
                if href:
                    if not href.startswith('http'):
                        href = f"https://www.zeptonow.com{href}"
                    if href not in product_urls:
                        product_urls.append(href)

            if not product_urls:
                print("  No product URLs extracted")
                await browser.close()
                return []

            print(f"  Found {len(product_urls)} product URLs")

            # Step 5: Visit each product page
            results = []
            for idx, product_url in enumerate(product_urls[:3], 1):
                try:
                    print(f"\n  [{idx}/{min(len(product_urls), 3)}] Visiting: {product_url}")
                    await page.goto(product_url, timeout=20000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)

                    product = await _extract_zepto_product(page, product_url)
                    if product:
                        results.append(product)
                        print(f"     Scraped: {product['product_name'][:40]}")
                except Exception as e:
                    print(f"     Error: {str(e)[:100]}")
                    continue

            await browser.close()
            print(f"\n  Zepto: Completed {len(results)} products\n")
            return results

        except Exception as e:
            print(f"  Zepto error: {e}")
            import traceback
            traceback.print_exc()
            await browser.close()
            return []


async def _extract_zepto_product(page, product_url):
    """Extract full compliance data from a Zepto product page."""
    try:
        data = {
            "platform": "zepto",
            "store_name": "Zepto",
            "product_url": product_url,
        }

        page_content = await page.content()

        # -- Product Name --
        for sel in ['h1', '[data-testid="product-name"]', 'h2[class*="product"]', '[class*="ProductTitle"]']:
            el = await page.query_selector(sel)
            if el:
                data["product_name"] = (await el.inner_text()).strip()
                break
        data.setdefault("product_name", "Unknown Product")

        # -- Extract from JSON payload (Zepto embeds data in __next_f.push) --
        try:
            pushes = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', page_content)
            full_payload = "".join(pushes).replace('\\"', '"').replace('\\\\', '\\')

            # Price and MRP
            price_match = re.search(r'"sellingPrice":(\d+)', full_payload)
            mrp_match = re.search(r'"mrp":(\d+)', full_payload)
            if price_match:
                data["price"] = str(int(price_match.group(1)) / 100.0)
            if mrp_match:
                data["mrp"] = str(int(mrp_match.group(1)) / 100.0)

            # Weight
            weight_match = re.search(r'"formattedPackSize":"(.*?)"', full_payload)
            if weight_match:
                data["weight"] = weight_match.group(1)

            # Highlights (ingredients, FSSAI, etc.)
            highlights_match = re.search(r'"highlights":\[(.*?)\](?:,|\})', full_payload)
            if highlights_match:
                try:
                    highlights_data = json.loads(f'[{highlights_match.group(1)}]')
                    for h in highlights_data:
                        key = str(h.get('key', '')).lower()
                        value = str(h.get('value', 'N/A'))
                        if 'ingredients' in key:
                            data["ingredients"] = value
                        elif 'fssai' in key:
                            fssai_clean = re.sub(r'[^\d]', '', value)
                            if len(fssai_clean) == 14:
                                data["fssai_number"] = fssai_clean
                except:
                    pass

            # Information (manufacturer, expiry, etc.)
            info_match = re.search(r'"information":\[(.*?)\](?:,|\})', full_payload)
            if info_match:
                try:
                    info_data = json.loads(f'[{info_match.group(1)}]')
                    for info in info_data:
                        key = str(info.get('key', '')).lower()
                        value = str(info.get('value', 'N/A'))
                        if 'manufacturer name' in key or 'mfg name' in key:
                            data["manufacturer_name"] = value
                        elif 'manufacturer address' in key or 'mfg address' in key:
                            data["manufacturer_address"] = value
                        elif 'shelf life' in key or 'expiry' in key or 'best before' in key:
                            data["expiry_date"] = value
                        elif 'disclaimer' in key or 'legal' in key:
                            data["legal_declarations"] = value
                        elif 'country of origin' in key:
                            data["country_of_origin"] = value
                except:
                    pass

        except Exception as json_err:
            print(f"     Warning: JSON extraction: {str(json_err)[:100]}")

        # -- Fallback: DOM extraction --
        if "price" not in data:
            price_el = await page.query_selector('[data-testid="product-price"], h4[class*="price"]')
            if price_el:
                price_text = await price_el.inner_text()
                data["price"] = re.sub(r'[^\d.]', '', price_text)

        if "mrp" not in data:
            mrp_el = await page.query_selector('[data-testid="product-mrp"], [class*="mrp"]')
            if mrp_el:
                mrp_text = await mrp_el.inner_text()
                data["mrp"] = re.sub(r'[^\d.]', '', mrp_text)

        # -- Defaults --
        data.setdefault("price", "N/A")
        data.setdefault("mrp", "N/A")
        data.setdefault("weight", "N/A")
        data.setdefault("ingredients", "N/A")
        data.setdefault("fssai_number", "N/A")
        data.setdefault("manufacturer_name", "N/A")
        data.setdefault("manufacturer_address", "N/A")
        data.setdefault("expiry_date", "N/A")
        data.setdefault("legal_declarations", "N/A")

        # -- ALL images --
        print("  Extracting all images...")
        img_selectors = [
            'img[data-testid="product-image"]',
            '[data-testid="image-carousel"] img',
            'img[class*="product"]',
            'img[src*="zepto"]',
            'img[src*="cloudfront"]',
            '[class*="image-gallery"] img',
            '[class*="carousel"] img',
        ]
        all_images = set()
        for sel in img_selectors:
            for img in await page.query_selector_all(sel):
                src = await img.get_attribute('src')
                if src and src.startswith('http') and 'placeholder' not in src.lower() and 'logo' not in src.lower():
                    src = src.replace('/w=200', '/w=800').replace('/w=300', '/w=800')
                    all_images.add(src)

        data["product_images"] = list(all_images) if all_images else []
        data["product_image"] = list(all_images)[0] if all_images else "N/A"
        print(f"     Found {len(all_images)} images")

        # -- Additional regex extraction --
        if data["fssai_number"] == "N/A":
            fssai_match = re.search(r'FSSAI[^0-9]*(\d{14})', page_content, re.I)
            if fssai_match:
                data["fssai_number"] = fssai_match.group(1)

        if data["expiry_date"] == "N/A":
            for pattern in [
                r'(?:Best Before|Expiry|Use By|Shelf Life)[:\s\-]+(.*?)(?:<|,|\n|$)',
                r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
                r'(\d+\s*(?:days?|months?|years?))',
            ]:
                exp_match = re.search(pattern, page_content, re.I)
                if exp_match:
                    data["expiry_date"] = exp_match.group(1).strip()[:100]
                    break

        # -- Description --
        desc_el = await page.query_selector('[data-testid="product-description"], [class*="description"]')
        data["description"] = (await desc_el.inner_text()).strip()[:500] if desc_el else data["product_name"]

        # -- Discount --
        try:
            pv, mv = float(data["price"]), float(data["mrp"])
            data["discount"] = str(int(((mv - pv) / mv) * 100)) if mv > pv else "0"
        except:
            data["discount"] = "0"

        return data

    except Exception as e:
        print(f"     Extraction error: {str(e)[:100]}")
        return None
