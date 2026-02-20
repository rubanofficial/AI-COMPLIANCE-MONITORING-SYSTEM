"""
Blinkit Product Detail Scraper
Scrapes the product detail page: only the gallery images, and the full
Highlights / product-info sections — ignoring similar/related product images.
"""
import asyncio
import re
import traceback
from playwright.async_api import async_playwright


async def scrape_blinkit_detail(product_url: str) -> dict:
    """
    Scrape full product details from a Blinkit product page URL.
    Only collects images from the product's own gallery (not carousels below).
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900}
        )
        page = await context.new_page()

        result = {
            "platform": "blinkit",
            "product_url": product_url,
            "product_name": "N/A",
            "brand": "N/A",
            "price": "N/A",
            "mrp": "N/A",
            "discount": "N/A",
            "weight": "N/A",
            "description": "N/A",
            "images": [],
            "highlights": {},
            "ingredients": "N/A",
            "nutritional_info": "N/A",
            "fssai_number": "N/A",
            "manufacturer_name": "N/A",
            "manufacturer_address": "N/A",
            "country_of_origin": "N/A",
            "expiry_date": "N/A",
            "shelf_life": "N/A",
            "seller_name": "N/A",
            "category": "N/A",
        }

        try:
            await page.goto(product_url, timeout=30000, wait_until="domcontentloaded")
            await asyncio.sleep(3)

            # Trigger lazy-load
            await page.evaluate("window.scrollTo(0, 600)")
            await asyncio.sleep(1)
            await page.evaluate("window.scrollTo(0, 0)")
            await asyncio.sleep(0.5)

            # ─────────────────────────────────────────────────────────────
            # 1. PRODUCT NAME
            # ─────────────────────────────────────────────────────────────
            for sel in [
                "h1",
                '[class*="ProductName"]',
                '[class*="product-name"]',
                '[class*="productName"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt and len(txt) > 2:
                        result["product_name"] = txt
                        break

            # ─────────────────────────────────────────────────────────────
            # 2. PRICE + MRP
            # ─────────────────────────────────────────────────────────────
            price_text = ""
            mrp_text = ""

            for sel in [
                '[class*="tw-text-300"][class*="tw-font-semibold"]',
                '[class*="Price"] [class*="tw-font-semibold"]',
                '[class*="selling-price"]',
                '[class*="sellingPrice"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip().replace("₹", "").strip()
                    if txt:
                        price_text = txt
                        result["price"] = txt
                        break

            for sel in [
                ".tw-line-through",
                '[class*="mrp"]',
                '[class*="Mrp"]',
                '[class*="originalPrice"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip().replace("₹", "").strip()
                    if txt:
                        mrp_text = txt
                        result["mrp"] = txt
                        break

            # ─────────────────────────────────────────────────────────────
            # 3. DISCOUNT
            # ─────────────────────────────────────────────────────────────
            for sel in [
                '[class*="tw-bg-brand-green"]',
                '[class*="DiscountBadge"]',
                '[class*="discount"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if re.search(r'\d+\s*%', txt):
                        result["discount"] = txt
                        break

            if result["discount"] == "N/A" and price_text and mrp_text:
                try:
                    p_val, m_val = float(price_text), float(mrp_text)
                    if m_val > p_val:
                        result["discount"] = f"{round((m_val-p_val)/m_val*100)}% OFF"
                except Exception:
                    pass

            # ─────────────────────────────────────────────────────────────
            # 4. PRODUCT IMAGES – only from the product gallery, not carousels
            # ─────────────────────────────────────────────────────────────
            images = await page.evaluate("""
                () => {
                    const stopTexts = [
                        'similar products', 'you might also like',
                        'frequently bought', 'customers also',
                        'more from', 'related products', 'also bought'
                    ];

                    // Identify where "similar products" section starts
                    let stopEl = null;
                    const headings = document.querySelectorAll('h2,h3,h4,h5,[class*="heading"]');
                    for (const h of headings) {
                        const ht = (h.innerText || '').toLowerCase();
                        if (stopTexts.some(s => ht.includes(s))) {
                            stopEl = h.closest('section, [class*="section"], div[class]') || h.parentElement;
                            break;
                        }
                    }

                    // First try: find explicit gallery container
                    const gallerySelectors = [
                        '[class*="gallery"]',
                        '[class*="Gallery"]',
                        '[class*="ProductImage"]',
                        '[class*="product-image"]',
                        '[class*="ImageCarousel"]',
                        '[class*="pdpImage"]',
                        '[class*="image-container"]',
                    ];
                    for (const sel of gallerySelectors) {
                        const el = document.querySelector(sel);
                        if (!el) continue;
                        // Make sure the gallery is NOT inside a similar products section
                        if (stopEl && (el === stopEl || stopEl.contains(el))) continue;
                        const imgs = el.querySelectorAll('img');
                        if (imgs.length === 0) continue;
                        const srcs = [];
                        for (const img of imgs) {
                            const src = img.src || img.getAttribute('data-src') || '';
                            if (
                                src && src.startsWith('http') &&
                                !src.includes('placeholder') &&
                                !src.includes('logo') &&
                                !src.includes('icon')
                            ) {
                                if (!srcs.includes(src)) srcs.push(src);
                            }
                        }
                        if (srcs.length > 0) return srcs.slice(0, 12);
                    }

                    // Fallback: collect page images from the top, stop before similar products
                    const fallback = [];
                    for (const img of document.querySelectorAll('img')) {
                        if (stopEl && (stopEl.contains(img) || (stopEl.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING) > 0)) {
                            // img comes after stopEl in the DOM – check carefully
                            const pos = stopEl.compareDocumentPosition(img);
                            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) break;
                        }
                        // Skip if inside a stop section
                        let skip = false;
                        let p = img.parentElement;
                        for (let i = 0; i < 8 && p; i++) {
                            const cls = (p.className || '').toLowerCase();
                            if (cls.includes('similar') || cls.includes('recommendation') ||
                                cls.includes('related') || cls.includes('also-like')) {
                                skip = true; break;
                            }
                            p = p.parentElement;
                        }
                        if (skip) continue;
                        const src = img.src || img.getAttribute('data-src') || '';
                        const w = img.naturalWidth || img.width;
                        const h = img.naturalHeight || img.height;
                        if (
                            src && src.startsWith('http') &&
                            !src.includes('placeholder') &&
                            !src.includes('logo') &&
                            !src.includes('icon') &&
                            !(w > 0 && w < 50) && !(h > 0 && h < 50)
                        ) {
                            if (!fallback.includes(src)) fallback.push(src);
                        }
                    }
                    return fallback.slice(0, 12);
                }
            """)

            result["images"] = images or []

            # ─────────────────────────────────────────────────────────────
            # 5. HIGHLIGHTS / INFO KEY-VALUE TABLE
            # Blinkit uses a table/grid of label:value pairs on the product page
            # ─────────────────────────────────────────────────────────────
            all_kv = await page.evaluate("""
                () => {
                    const result = {};

                    // Method 1: <table> rows
                    const tables = document.querySelectorAll('table');
                    for (const table of tables) {
                        if (table.closest('[class*="similar"], [class*="recommendation"]')) continue;
                        const rows = table.querySelectorAll('tr');
                        for (const row of rows) {
                            const cells = row.querySelectorAll('td, th');
                            if (cells.length >= 2) {
                                const k = (cells[0].innerText || '').trim();
                                const v = cells[1].innerText.trim();
                                if (k && v && k.length < 80) result[k] = v;
                            }
                        }
                    }

                    // Method 2: definition lists
                    document.querySelectorAll('dt').forEach(dt => {
                        const dd = dt.nextElementSibling;
                        if (dd && dd.tagName === 'DD') {
                            const k = dt.innerText.trim();
                            const v = dd.innerText.trim();
                            if (k && v && k.length < 80) result[k] = v;
                        }
                    });

                    // Method 3: look for Highlights/Information section headings
                    const targetHeadings = ['Highlights', 'Information', 'Product Details',
                        'Details', 'Specifications', 'About'];
                    const allEls = document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div');
                    for (const el of allEls) {
                        const ht = (el.innerText || '').trim();
                        if (!targetHeadings.includes(ht)) continue;
                        let container = el.nextElementSibling;
                        if (!container) container = el.parentElement?.nextElementSibling;
                        if (!container) continue;

                        // Parse rows inside container
                        const rows = container.querySelectorAll(
                            'tr, [class*="row"], [class*="Row"], [class*="item"], li'
                        );
                        for (const row of rows) {
                            const cols = Array.from(row.children).filter(
                                c => (c.innerText || '').trim()
                            );
                            if (cols.length >= 2) {
                                const k = (cols[0].innerText || '').trim();
                                const v = cols.slice(1).map(c => c.innerText.trim()).join(' ');
                                if (k && v && k.length < 80) result[k] = v;
                            }
                        }

                        // Also try text that has ':' separators
                        if (Object.keys(result).length === 0) {
                            const text = container.innerText || '';
                            const lines = text.split('\\n').filter(Boolean);
                            for (const line of lines) {
                                if (line.includes(':')) {
                                    const idx = line.indexOf(':');
                                    const k = line.slice(0, idx).trim();
                                    const v = line.slice(idx+1).trim();
                                    if (k && v && k.length < 80) result[k] = v;
                                }
                            }
                        }
                    }

                    // Method 4: generic grid with short-label + longer-value pattern
                    if (Object.keys(result).length < 3) {
                        const containers = document.querySelectorAll(
                            '[class*="highlight"], [class*="Highlight"],'
                            + '[class*="detail"], [class*="Detail"],'
                            + '[class*="info"], [class*="Info"]'
                        );
                        for (const c of containers) {
                            if (c.closest('[class*="similar"], [class*="card"], [class*="product-card"]')) continue;
                            const items = c.querySelectorAll('[class*="item"], [class*="row"], li, tr');
                            for (const item of items) {
                                const children = Array.from(item.children).filter(
                                    ch => (ch.innerText || '').trim()
                                );
                                if (children.length >= 2) {
                                    const k = (children[0].innerText || '').trim();
                                    const v = children.slice(1).map(ch => ch.innerText.trim()).join(' ');
                                    if (k && v && k.length < 80) result[k] = v;
                                }
                            }
                        }
                    }

                    return result;
                }
            """)

            if all_kv:
                result["highlights"] = all_kv

            # ─────────────────────────────────────────────────────────────
            # 6. Map k/v into structured fields
            # ─────────────────────────────────────────────────────────────
            for k, v in all_kv.items():
                kl = k.lower().strip()
                vl = str(v).strip()
                if not vl or vl == "N/A":
                    continue
                if "brand" in kl:
                    result["brand"] = vl
                elif "fssai" in kl or "lic" in kl and "fssai" in vl.lower():
                    result["fssai_number"] = re.sub(r'[^\d]', '', vl)[:14] or vl
                elif "ingredient" in kl:
                    result["ingredients"] = vl
                elif "manufacturer" in kl and ("name" in kl or "by" in kl):
                    result["manufacturer_name"] = vl
                elif "manufacturer" in kl and "address" in kl:
                    result["manufacturer_address"] = vl
                elif "packer" in kl or "packed by" in kl:
                    if result["manufacturer_name"] == "N/A":
                        result["manufacturer_name"] = vl
                elif "seller" in kl:
                    result["seller_name"] = vl
                elif "country" in kl and "origin" in kl:
                    result["country_of_origin"] = vl
                elif "shelf life" in kl:
                    result["shelf_life"] = vl
                    if result["expiry_date"] == "N/A":
                        result["expiry_date"] = vl
                elif "expiry" in kl or "best before" in kl or "use by" in kl:
                    result["expiry_date"] = vl
                elif "nutritional" in kl or "nutrition" in kl:
                    result["nutritional_info"] = vl
                elif "net quantity" in kl or "net weight" in kl or "weight" in kl:
                    if result["weight"] == "N/A":
                        result["weight"] = vl
                elif "category" in kl:
                    result["category"] = vl

            # ─────────────────────────────────────────────────────────────
            # 7. FSSAI fallback – regex
            # ─────────────────────────────────────────────────────────────
            if result["fssai_number"] == "N/A":
                page_text = await page.inner_text("body")
                m = re.search(r'FSSAI[:\s#Lic.]*([\d\s]{14,17})', page_text, re.IGNORECASE)
                if not m:
                    m = re.search(r'\b\d{14}\b', page_text)
                if m:
                    raw = re.sub(r'\D', '', m.group(1) if m.lastindex else m.group(0))
                    if len(raw) >= 14:
                        result["fssai_number"] = raw[:14]

            # ─────────────────────────────────────────────────────────────
            # 8. Description
            # ─────────────────────────────────────────────────────────────
            for sel in [
                '[class*="Description"]',
                '[class*="description"]',
                '[class*="AboutProduct"]',
                '[class*="about-product"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt and len(txt) > 15:
                        result["description"] = txt[:1500]
                        break

            await browser.close()
            return result

        except Exception:
            traceback.print_exc()
            try:
                await browser.close()
            except Exception:
                pass
            return result


        result = {
            "platform": "blinkit",
            "product_url": product_url,
            "product_name": "N/A",
            "brand": "N/A",
            "price": "N/A",
            "mrp": "N/A",
            "discount": "N/A",
            "weight": "N/A",
            "description": "N/A",
            "images": [],
            "highlights": {},
            "ingredients": "N/A",
            "nutritional_info": "N/A",
            "fssai_number": "N/A",
            "manufacturer_name": "N/A",
            "manufacturer_address": "N/A",
            "country_of_origin": "N/A",
            "expiry_date": "N/A",
            "category": "N/A",
        }

        try:
            await page.goto(product_url, timeout=25000, wait_until="domcontentloaded")
            await asyncio.sleep(2)

            # ── Product Name ──────────────────────────────────────────────
            for sel in [
                "h1",
                '[class*="ProductName"]',
                '[class*="product-name"]',
                '[class*="productName"]',
                ".tw-text-500",
            ]:
                el = await page.query_selector(sel)
                if el:
                    name = (await el.inner_text()).strip()
                    if name:
                        result["product_name"] = name
                        break

            # ── Price ─────────────────────────────────────────────────────
            for sel in [
                '[class*="tw-text-300"][class*="tw-font-semibold"]',
                '[class*="Price"] [class*="tw-font"]',
                '[data-testid="product-price"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt and "₹" in txt:
                        result["price"] = txt.replace("₹", "").strip()
                        break

            # ── MRP ───────────────────────────────────────────────────────
            for sel in [
                ".tw-line-through",
                '[class*="mrp"]',
                '[class*="Mrp"]',
                '[class*="originalPrice"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt:
                        result["mrp"] = txt.replace("₹", "").strip()
                        break

            # ── Discount ──────────────────────────────────────────────────
            for sel in [
                '[class*="tw-bg-brand-green"] [class*="tw-text"]',
                '[class*="DiscountBadge"]',
                '[class*="discount"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if "%" in txt:
                        result["discount"] = txt
                        break

            # ── Weight / Pack size ────────────────────────────────────────
            for sel in [
                '[class*="tw-text-200"][class*="tw-font-medium"]',
                '[class*="PackSize"]',
                '[class*="pack-size"]',
                '[class*="weight"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt and txt not in ("", "N/A"):
                        result["weight"] = txt
                        break

            # ── All Product Images ────────────────────────────────────────
            images = set()
            # Blinkit typically has images in a slider
            for sel in [
                '[class*="ProductImage"] img',
                '[class*="product-image"] img',
                '[class*="ProductMedia"] img',
                '[class*="ImageContainer"] img',
                '[class*="Carousel"] img',
                '[class*="slider"] img',
            ]:
                els = await page.query_selector_all(sel)
                for img_el in els:
                    src = await img_el.get_attribute("src")
                    if not src or src.startswith("data:"):
                        src = await img_el.get_attribute("data-src") or ""
                    if src and "placeholder" not in src.lower() and src.startswith("http"):
                        images.add(src)

            # Fallback: any non-tiny img on page
            if not images:
                all_imgs = await page.query_selector_all("img")
                for img_el in all_imgs:
                    src = await img_el.get_attribute("src") or ""
                    if not src or src.startswith("data:"):
                        src = await img_el.get_attribute("data-src") or ""
                    if (
                        src
                        and src.startswith("http")
                        and "placeholder" not in src.lower()
                        and "logo" not in src.lower()
                        and "icon" not in src.lower()
                    ):
                        w = await img_el.get_attribute("width")
                        h = await img_el.get_attribute("height")
                        try:
                            if w and int(w) < 60:
                                continue
                            if h and int(h) < 60:
                                continue
                        except Exception:
                            pass
                        images.add(src)

            result["images"] = list(images)[:12]

            # ── Description / About ───────────────────────────────────────
            for sel in [
                '[class*="Description"]',
                '[class*="description"]',
                '[class*="AboutProduct"]',
                '[class*="about-product"]',
                '[id*="description"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt and len(txt) > 10:
                        result["description"] = txt[:1000]
                        break

            # ── Highlights / Key Info table ───────────────────────────────
            highlights = {}
            # Blinkit uses a grid/table with label-value pairs for highlights
            highlight_containers = await page.query_selector_all(
                '[class*="Highlights"] tr, [class*="highlight"] tr, [class*="KeyInfo"] tr'
            )
            for row in highlight_containers:
                tds = await row.query_selector_all("td")
                if len(tds) >= 2:
                    key = (await tds[0].inner_text()).strip()
                    val = (await tds[1].inner_text()).strip()
                    if key and val:
                        highlights[key] = val

            # Also try definition-list style
            if not highlights:
                dl_containers = await page.query_selector_all(
                    '[class*="Highlight"] dl, [class*="highlight"] dl'
                )
                for dl in dl_containers:
                    dts = await dl.query_selector_all("dt")
                    dds = await dl.query_selector_all("dd")
                    for dt, dd in zip(dts, dds):
                        k = (await dt.inner_text()).strip()
                        v = (await dd.inner_text()).strip()
                        if k:
                            highlights[k] = v

            # Try generic key-value grid approach
            if not highlights:
                kv_rows = await page.query_selector_all(
                    '[class*="Row"], [class*="InfoRow"], [class*="DetailRow"]'
                )
                for row in kv_rows[:20]:
                    spans = await row.query_selector_all("span, div")
                    if len(spans) >= 2:
                        k = (await spans[0].inner_text()).strip()
                        v = (await spans[1].inner_text()).strip()
                        if k and v and len(k) < 50 and len(v) < 200:
                            highlights[k] = v

            result["highlights"] = highlights

            # ── Brand ─────────────────────────────────────────────────────
            brand = highlights.get("Brand") or highlights.get("brand") or highlights.get("Brand Name", "N/A")
            result["brand"] = brand

            # ── Regulatory / Label fields from highlights ─────────────────
            for k, v in highlights.items():
                kl = k.lower()
                if "fssai" in kl:
                    result["fssai_number"] = v
                elif "ingredient" in kl:
                    result["ingredients"] = v
                elif "manufacturer" in kl and "name" in kl:
                    result["manufacturer_name"] = v
                elif "manufacturer" in kl and "address" in kl:
                    result["manufacturer_address"] = v
                elif "country" in kl and "origin" in kl:
                    result["country_of_origin"] = v
                elif "expiry" in kl or "best before" in kl or "shelf" in kl:
                    result["expiry_date"] = v
                elif "nutritional" in kl or "nutrition" in kl:
                    result["nutritional_info"] = v
                elif "category" in kl:
                    result["category"] = v

            # Fallback ingredient search in page text
            if result["ingredients"] == "N/A":
                for sel in ['[class*="Ingredient"]', '[class*="ingredient"]']:
                    el = await page.query_selector(sel)
                    if el:
                        txt = (await el.inner_text()).strip()
                        if txt:
                            result["ingredients"] = txt[:500]
                            break

            # ── FSSAI fallback – regex scan of entire page text ───────────
            if result["fssai_number"] == "N/A":
                import re
                page_text = await page.inner_text("body")
                m = re.search(r'\b\d{14}\b', page_text)
                if m:
                    result["fssai_number"] = m.group(0)

            await browser.close()
            return result

        except Exception:
            traceback.print_exc()
            try:
                await browser.close()
            except Exception:
                pass
            return result
