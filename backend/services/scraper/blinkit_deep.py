from playwright.async_api import async_playwright
import re
import asyncio


async def scrape_blinkit_deep(query: str, is_direct_url: bool = False):
    """
    Robust Blinkit scraper with proper location handling.
    1. Sets delivery location first (visits homepage)
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

        # -- helpers --
        async def goto(url, retries=2):
            for attempt in range(1, retries + 1):
                try:
                    print(f"  Attempting ({attempt}/{retries}): {url}")
                    await page.goto(url, timeout=45000, wait_until="domcontentloaded")
                    return True
                except Exception as e:
                    print(f"  Warning: Navigation failed: {str(e)[:120]}")
                    await asyncio.sleep(2)
            return False

        async def set_location():
            """Set delivery location on Blinkit (homepage flow)."""
            selectors = [
                'input[placeholder*="delivery location"]',
                'input[placeholder*="location"]',
                'input[placeholder*="area"]',
                'input[placeholder*="pincode"]',
            ]
            loc_input = None
            for sel in selectors:
                loc_input = await page.query_selector(sel)
                if loc_input:
                    break

            if not loc_input:
                for btn_sel in [
                    'button:has-text("Select")',
                    '[class*="location"]',
                    '[class*="address"]',
                    '[data-testid*="location"]',
                ]:
                    btn = await page.query_selector(btn_sel)
                    if btn:
                        try:
                            await btn.click()
                            await page.wait_for_timeout(2000)
                        except:
                            pass
                        for sel in selectors:
                            loc_input = await page.query_selector(sel)
                            if loc_input:
                                break
                    if loc_input:
                        break

            if not loc_input:
                print("  Warning: No location input found, proceeding anyway")
                return

            print("  Setting delivery location to Gurugram...")
            await loc_input.click()
            await loc_input.fill("Gurugram")
            await page.wait_for_timeout(3000)

            suggestion_selectors = [
                '[class*="LocationSearchList"] div:first-child',
                '[class*="suggestion"]:first-child',
                '[class*="dropdown"] div:first-child',
                'li:has-text("Gurugram")',
                'div:has-text("Gurugram, Haryana")',
            ]
            clicked = False
            for sel in suggestion_selectors:
                try:
                    el = await page.query_selector(sel)
                    if el:
                        await el.click()
                        clicked = True
                        print("  Location suggestion clicked")
                        break
                except:
                    continue

            if not clicked:
                await page.keyboard.press("ArrowDown")
                await page.keyboard.press("Enter")
                print("  Location submitted via keyboard")

            await page.wait_for_timeout(5000)

        # -- main logic --
        try:
            if is_direct_url:
                print(f"\n  Blinkit: Direct product URL")
                print(f"  URL: {query}")
                if not await goto(query):
                    await browser.close()
                    return []
                await page.wait_for_timeout(4000)
                await set_location()
                product = await _extract_product(page, query)
                await browser.close()
                return [product] if product else []

            print(f"\n  Blinkit: Searching for '{query}'")

            # Step 1: Visit homepage and set location
            print("  Setting delivery location first...")
            if not await goto("https://blinkit.com"):
                await browser.close()
                return []
            await page.wait_for_timeout(3000)
            await set_location()

            # Step 2: Navigate to search
            search_url = f"https://blinkit.com/s/?q={query}"
            print(f"  Navigating to search: {search_url}")
            if not await goto(search_url):
                await browser.close()
                return []
            await page.wait_for_timeout(5000)

            # Step 3: Collect product URLs
            print("  Extracting product links...")
            product_urls = await _collect_product_urls(page)

            if not product_urls:
                print("  No product links found, trying direct card extraction...")
                products = await _extract_search_cards(page)
                if products:
                    await browser.close()
                    print(f"\n  Blinkit: Completed {len(products)} products (from search cards)\n")
                    return products

                html = await page.content()
                with open("blinkit_debug_search.html", "w", encoding="utf-8") as f:
                    f.write(html)
                print("  No products found. Debug HTML saved to blinkit_debug_search.html")
                await browser.close()
                return []

            print(f"  Found {len(product_urls)} product URLs")

            # Step 4: Visit each product page
            results = []
            for idx, url in enumerate(product_urls[:3], 1):
                print(f"\n  [{idx}/{min(len(product_urls), 3)}] Visiting: {url}")
                try:
                    if not await goto(url):
                        continue
                    await page.wait_for_timeout(3000)
                    product = await _extract_product(page, url)
                    if product:
                        results.append(product)
                        print(f"     Scraped: {product['product_name'][:40]}")
                except Exception as e:
                    print(f"     Error: {str(e)[:120]}")

            await browser.close()
            print(f"\n  Blinkit: Completed {len(results)} products\n")
            return results

        except Exception as e:
            print(f"  Blinkit error: {e}")
            import traceback
            traceback.print_exc()
            await browser.close()
            return []


async def _collect_product_urls(page):
    """Try multiple selector strategies to find product page URLs."""
    urls = []

    link_selectors = [
        'a[href*="/prn/"]',
        'a[href*="/product/"]',
        'a[href*="/p/"]',
        'div[role="listitem"] a',
        '[class*="Product"] a',
        '[class*="product-card"] a',
    ]
    for sel in link_selectors:
        links = await page.query_selector_all(sel)
        for link in links[:8]:
            href = await link.get_attribute("href")
            if href:
                if not href.startswith("http"):
                    href = f"https://blinkit.com{href}"
                if href not in urls and "blinkit.com" in href:
                    urls.append(href)
        if urls:
            return urls

    content = await page.content()
    for pattern in [r'href="(/prn/[^"]+)"', r'href="(/product/[^"]+)"']:
        for href in re.findall(pattern, content)[:5]:
            full = f"https://blinkit.com{href}"
            if full not in urls:
                urls.append(full)
    return urls


async def _extract_search_cards(page):
    """Extract basic product data directly from search result cards."""
    results = []
    containers = await page.query_selector_all(
        'div[role="button"], [class*="Product"], [class*="product-card"]'
    )
    for container in containers[:5]:
        try:
            text = await container.inner_text()
            if "₹" not in text:
                continue

            link = await container.query_selector("a")
            href = (await link.get_attribute("href")) if link else None
            product_url = (
                f"https://blinkit.com{href}"
                if href and not href.startswith("http")
                else (href or "https://blinkit.com")
            )

            name_el = await container.query_selector("h3, h2, div[class*='name'], div[class*='title']")
            name = (await name_el.inner_text()).strip() if name_el else "Unknown Product"

            price_matches = re.findall(r'₹\s*(\d+)', text)
            if not price_matches:
                continue
            price = price_matches[0]
            mrp = price_matches[1] if len(price_matches) > 1 else price

            img_el = await container.query_selector("img")
            img_src = (await img_el.get_attribute("src")) if img_el else "N/A"

            discount = "0"
            try:
                pv, mv = float(price), float(mrp)
                if mv > pv:
                    discount = str(int(((mv - pv) / mv) * 100))
            except:
                pass

            results.append({
                "platform": "blinkit",
                "store_name": "Blinkit",
                "product_name": name,
                "price": price,
                "mrp": mrp,
                "product_url": product_url,
                "product_image": img_src or "N/A",
                "product_images": [img_src] if img_src else [],
                "description": name,
                "weight": "N/A",
                "discount": discount,
                "ingredients": "N/A",
                "manufacturer_name": "N/A",
                "manufacturer_address": "N/A",
                "fssai_number": "N/A",
                "expiry_date": "N/A",
                "legal_declarations": "N/A",
            })
            print(f"  From search card: {name[:40]} (Rs {price})")
        except:
            continue
    return results


async def _extract_product(page, product_url):
    """Extract full compliance data from a Blinkit product page."""
    try:
        data = {
            "platform": "blinkit",
            "store_name": "Blinkit",
            "product_url": product_url,
        }

        html = await page.content()

        for sel in ["h1", '[class*="ProductName"]', '[data-testid="product-name"]', ".product-title"]:
            el = await page.query_selector(sel)
            if el:
                data["product_name"] = (await el.inner_text()).strip()
                break
        data.setdefault("product_name", "Unknown Product")

        price_matches = re.findall(r'₹[\s]*(\d+(?:\.\d{1,2})?)', html)
        if price_matches:
            prices = sorted(set(float(p) for p in price_matches))
            data["price"] = str(prices[0])
            data["mrp"] = str(prices[-1]) if len(prices) > 1 else str(prices[0])
        else:
            data["price"] = "N/A"
            data["mrp"] = "N/A"

        for sel in ['[class*="pack-size"]', '[class*="weight"]', '[class*="quantity"]']:
            el = await page.query_selector(sel)
            if el:
                data["weight"] = (await el.inner_text()).strip()
                break
        if "weight" not in data:
            m = re.search(r'(\d+(?:\.\d+)?\s*(?:kg|g|ml|l|litre|ltr|gm|gram))', html, re.I)
            data["weight"] = m.group(1) if m else "N/A"

        print("  Extracting all images...")
        img_selectors = [
            'img[src*="cdn.grofers.com"]',
            'img[src*="blinkit"]',
            'img[src*="product"]',
            '[class*="image-carousel"] img',
            '[class*="product-image"] img',
            '.slick-track img',
            '[class*="Carousel"] img',
        ]
        images = set()
        for sel in img_selectors:
            for img in await page.query_selector_all(sel):
                src = await img.get_attribute("src")
                if src and src.startswith("http") and "placeholder" not in src.lower() and "logo" not in src.lower():
                    src = re.sub(r'/w_\d+/', '/w_800/', src)
                    images.add(src)
        data["product_images"] = list(images)
        data["product_image"] = list(images)[0] if images else "N/A"
        print(f"     Found {len(images)} images")

        m = re.search(r'FSSAI[^0-9]*(\d{14})', html, re.I)
        data["fssai_number"] = m.group(1) if m else "N/A"

        m = re.search(r'Ingredients?[:\s\-]+(.*?)(?:<|Nutritional|Manufacturer|$)', html, re.I | re.DOTALL)
        data["ingredients"] = m.group(1).strip()[:500] if m else "N/A"

        m = re.search(
            r'(?:Manufactured|Mfd|Marketed|Mktd|Packed)\s+by[:\s\-]+(.*?)(?:<|FSSAI|Ingredients|$)',
            html, re.I | re.DOTALL,
        )
        if m:
            lines = [l.strip() for l in m.group(1).strip()[:300].split('\n') if l.strip()]
            data["manufacturer_name"] = lines[0] if lines else "N/A"
            data["manufacturer_address"] = ', '.join(lines[1:]) if len(lines) > 1 else "N/A"
        else:
            data["manufacturer_name"] = "N/A"
            data["manufacturer_address"] = "N/A"

        for pat in [
            r'(?:Best Before|Expiry|Use By|Shelf Life)[:\s\-]+(.*?)(?:<|\.|,|\n|$)',
            r'(?:BB|EXP)[:\s\-]+(.*?)(?:<|\.|,|\n|$)',
            r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
            r'(\d+\s*(?:days?|months?|years?))',
        ]:
            em = re.search(pat, html, re.I)
            if em:
                data["expiry_date"] = em.group(1).strip()[:100]
                break
        data.setdefault("expiry_date", "N/A")

        desc_el = await page.query_selector('[class*="description"], [class*="detail"]')
        data["description"] = (await desc_el.inner_text()).strip()[:500] if desc_el else data["product_name"]

        try:
            pv, mv = float(data["price"]), float(data["mrp"])
            data["discount"] = str(int(((mv - pv) / mv) * 100)) if mv > pv else "0"
        except:
            data["discount"] = "0"

        data["legal_declarations"] = "N/A"
        return data

    except Exception as e:
        print(f"     Extraction error: {str(e)[:120]}")
        return None
