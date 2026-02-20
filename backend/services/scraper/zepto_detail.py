"""
Zepto Product Detail Scraper
Scrapes the product detail page: only the gallery images, Highlights table, and Information table.
"""
import asyncio
import re
import traceback
from playwright.async_api import async_playwright


async def scrape_zepto_detail(product_url: str) -> dict:
    """
    Scrape full product details from a Zepto product page URL.
    Targets only the product image gallery (not similar/recommended product images)
    and the Highlights + Information key-value tables.
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
            "platform": "zepto",
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
            # Give Zepto's React app time to hydrate
            await asyncio.sleep(3)

            # ── Scroll the page to trigger lazy-load ──────────────────────
            await page.evaluate("window.scrollTo(0, 800)")
            await asyncio.sleep(1)
            await page.evaluate("window.scrollTo(0, 0)")
            await asyncio.sleep(0.5)

            # ─────────────────────────────────────────────────────────────
            # 1. PRODUCT NAME
            # ─────────────────────────────────────────────────────────────
            for sel in [
                "h1",
                '[class*="product-name"]',
                '[class*="productName"]',
                '[class*="ProductName"]',
                '[class*="pdp"] h1',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt and len(txt) > 2:
                        result["product_name"] = txt
                        break

            # ─────────────────────────────────────────────────────────────
            # 2. PRICE (current selling price)
            # ─────────────────────────────────────────────────────────────
            # Zepto shows the price as ₹49 in a green badge at bottom of image panel
            # Selectors for price container
            price_text = ""
            mrp_text = ""

            # Try structured price element first
            for sel in [
                '[class*="price"] [class*="selling"]',
                '[class*="offerPrice"]',
                '[class*="selling-price"]',
                '[class*="sellingPrice"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip().replace("₹", "").strip()
                    if txt and txt != "N/A":
                        price_text = txt
                        break

            # Fallback: find the first ₹ value on page that looks like a price
            if not price_text:
                # Use JS to find the visible price element (usually the green ₹XX badge)
                price_text = await page.evaluate("""
                    () => {
                        const xpath = "//span[contains(@class,'price') or contains(@class,'Price')]"
                        const iter = document.evaluate(xpath, document, null,
                            XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
                        let node = iter.iterateNext();
                        while (node) {
                            const t = (node.innerText || node.textContent || '').trim();
                            if (t && /^₹?\\d+/.test(t)) return t.replace('₹','').trim();
                            node = iter.iterateNext();
                        }
                        return '';
                    }
                """)

            result["price"] = price_text or "N/A"

            # ─────────────────────────────────────────────────────────────
            # 3. MRP
            # ─────────────────────────────────────────────────────────────
            for sel in [
                '[class*="mrp"]',
                '[class*="MRP"]',
                '[class*="originalPrice"]',
                '[class*="strikeThroughPrice"]',
                "s",   # <s> tag = strikethrough MRP
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip().replace("₹", "").strip()
                    if txt and txt != price_text:
                        mrp_text = txt
                        result["mrp"] = mrp_text
                        break

            # ─────────────────────────────────────────────────────────────
            # 4. DISCOUNT
            # ─────────────────────────────────────────────────────────────
            for sel in [
                '[class*="discount"]',
                '[class*="Discount"]',
                '[class*="offer"]',
                '[class*="saving"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if re.search(r'\d+\s*%', txt):
                        result["discount"] = txt
                        break

            # Compute from price/mrp if not found
            if result["discount"] == "N/A" and price_text and mrp_text:
                try:
                    p_val = float(price_text)
                    m_val = float(mrp_text)
                    if m_val > p_val:
                        pct = round((m_val - p_val) / m_val * 100)
                        result["discount"] = f"{pct}% OFF"
                except Exception:
                    pass

            # ─────────────────────────────────────────────────────────────
            # 5. PRODUCT IMAGES  –– ONLY from the product gallery panel
            # ─────────────────────────────────────────────────────────────
            images = []

            # Strategy: find the gallery/carousel container that holds only
            # the product's own images (left panel on Zepto PDP)
            # It's typically the first section above "Similar Products"
            gallery_images = await page.evaluate("""
                () => {
                    // Stop collecting images once we hit a section heading 
                    // like "Similar Products" or "You might also like"
                    const stopTexts = [
                        'similar products', 'you might also like',
                        'frequently bought', 'customers also', 'more from',
                        'related products', 'explore more'
                    ];

                    // Walk the DOM top-to-bottom, collect imgs until a stop section
                    const allSections = document.querySelectorAll(
                        'section, [class*="section"], [class*="similar"], '
                        + '[class*="recommendation"], [class*="carousel"], '
                        + '[class*="slider"]'
                    );

                    let stopEl = null;
                    for (const sec of allSections) {
                        const heading = sec.querySelector('h2,h3,h4,span,div');
                        if (heading) {
                            const ht = (heading.innerText || '').toLowerCase();
                            if (stopTexts.some(s => ht.includes(s))) {
                                stopEl = sec;
                                break;
                            }
                        }
                    }

                    // Also check all headings directly
                    if (!stopEl) {
                        const headings = document.querySelectorAll('h2,h3,h4');
                        for (const h of headings) {
                            const ht = (h.innerText || '').toLowerCase();
                            if (stopTexts.some(s => ht.includes(s))) {
                                stopEl = h.closest('section, div[class]') || h.parentElement;
                                break;
                            }
                        }
                    }

                    // Collect all imgs, but stop at stopEl
                    const collected = [];
                    const allImgs = document.querySelectorAll('img');
                    for (const img of allImgs) {
                        if (stopEl && stopEl.contains(img)) break;
                        // Also skip if the img's parent section heading contains stop words
                        let skip = false;
                        let p = img.parentElement;
                        for (let i = 0; i < 8 && p; i++) {
                            const cls = (p.className || '').toLowerCase();
                            if (
                                cls.includes('similar') ||
                                cls.includes('recommendation') ||
                                cls.includes('related') ||
                                cls.includes('explore') ||
                                cls.includes('also-like')
                            ) { skip = true; break; }
                            p = p.parentElement;
                        }
                        if (skip) continue;

                        const src = img.src || img.getAttribute('data-src') || '';
                        if (
                            src &&
                            src.startsWith('http') &&
                            !src.includes('placeholder') &&
                            !src.includes('logo') &&
                            !src.includes('icon') &&
                            !src.includes('banner') &&
                            !src.includes('sprite') &&
                            !src.includes('svg')
                        ) {
                            const w = img.naturalWidth || img.width;
                            const h = img.naturalHeight || img.height;
                            // Skip tiny images (icons, badges)
                            if ((w > 0 && w < 50) || (h > 0 && h < 50)) continue;
                            if (!collected.includes(src)) collected.push(src);
                        }
                    }
                    return collected;
                }
            """)

            # Also try to get images specifically from the left gallery column
            gallery_container_imgs = await page.evaluate("""
                () => {
                    // Zepto PDP: left column with thumbnails + main image
                    // Try to find the gallery wrapper (usually first child of a 2-col grid)
                    const candidates = [
                        document.querySelector('[class*="gallery"]'),
                        document.querySelector('[class*="Gallery"]'),
                        document.querySelector('[class*="ImageCarousel"]'),
                        document.querySelector('[class*="imageCarousel"]'),
                        document.querySelector('[class*="product-image"]'),
                        document.querySelector('[class*="pdp"] [class*="image"]'),
                        document.querySelector('[class*="pdpImage"]'),
                        document.querySelector('[class*="image-section"]'),
                    ];

                    for (const el of candidates) {
                        if (!el) continue;
                        const imgs = el.querySelectorAll('img');
                        if (imgs.length === 0) continue;
                        const srcs = [];
                        for (const img of imgs) {
                            const src = img.src || img.getAttribute('data-src') || '';
                            if (src && src.startsWith('http') && !src.includes('placeholder')) {
                                if (!srcs.includes(src)) srcs.push(src);
                            }
                        }
                        if (srcs.length > 0) return srcs;
                    }
                    return [];
                }
            """)

            # Prefer gallery-container images if we got them (more precise)
            if gallery_container_imgs:
                images = gallery_container_imgs
            elif gallery_images:
                # Keep only images that appear before any similar-product section
                images = gallery_images[:10]

            result["images"] = images

            # ─────────────────────────────────────────────────────────────
            # 6. HIGHLIGHTS + INFORMATION tables
            # Zepto shows two labelled sections:
            #   "Highlights" – Brand, Product Type, Key Features, Unit, etc.
            #   "Information" – Disclaimer, Customer Care, Seller Name,
            #                   Country Of Origin, Shelf Life, etc.
            # Each section is a grid of  label | value  rows.
            # ─────────────────────────────────────────────────────────────
            all_kv = await page.evaluate("""
                () => {
                    const result = {};

                    // Helper: extract k/v from a container element
                    function extractKV(container) {
                        if (!container) return;

                        // Method 1: look for direct child rows with 2+ children
                        const rows = container.querySelectorAll(
                            '[class*="row"], [class*="Row"], [class*="item"], [class*="Item"],'
                            + 'tr, li'
                        );
                        for (const row of rows) {
                            const children = Array.from(row.children).filter(
                                c => (c.innerText || '').trim()
                            );
                            if (children.length >= 2) {
                                const k = (children[0].innerText || '').trim();
                                const v = children.slice(1).map(c => (c.innerText || '').trim()).join(' ');
                                if (k && v && k.length < 80) result[k] = v;
                            }
                        }

                        // Method 2: look for paired <p> or <span> siblings
                        if (Object.keys(result).length === 0) {
                            const paras = container.querySelectorAll('p, span, div');
                            let lastKey = '';
                            for (const el of paras) {
                                const txt = (el.innerText || '').trim();
                                if (!txt || txt.length > 300) continue;
                                if (txt.endsWith(':') || /^[A-Za-z ]{2,40}$/.test(txt)) {
                                    lastKey = txt.replace(/:$/, '').trim();
                                } else if (lastKey) {
                                    result[lastKey] = txt;
                                    lastKey = '';
                                }
                            }
                        }
                    }

                    // Find section containers by heading text
                    const allHeadings = document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div');
                    for (const heading of allHeadings) {
                        const ht = (heading.innerText || '').trim();
                        if (!['Highlights', 'Information'].includes(ht)) continue;

                        // The container is usually the next sibling or parent's next child
                        let container = heading.nextElementSibling;
                        if (!container) container = heading.parentElement?.nextElementSibling;
                        if (!container) container = heading.closest('[class*="section"], [class*="Section"], div[class]');

                        if (container) extractKV(container);
                    }

                    // Fallback: try generic table rows across the detail page
                    if (Object.keys(result).length < 2) {
                        const tables = document.querySelectorAll('table');
                        for (const table of tables) {
                            const rows = table.querySelectorAll('tr');
                            for (const row of rows) {
                                const cells = row.querySelectorAll('td, th');
                                if (cells.length >= 2) {
                                    const k = (cells[0].innerText || '').trim();
                                    const v = (cells[1].innerText || '').trim();
                                    if (k && v) result[k] = v;
                                }
                            }
                        }
                    }

                    // Another fallback: definition list
                    if (Object.keys(result).length < 2) {
                        const dts = document.querySelectorAll('dt');
                        for (const dt of dts) {
                            const dd = dt.nextElementSibling;
                            if (dd && dd.tagName === 'DD') {
                                const k = (dt.innerText || '').trim();
                                const v = (dd.innerText || '').trim();
                                if (k && v) result[k] = v;
                            }
                        }
                    }

                    // Grid approach: find all elements that look like labels
                    // (short text followed by longer value in parallel grid)
                    if (Object.keys(result).length < 2) {
                        // Look for the highlights/info section by structure
                        const grids = document.querySelectorAll(
                            '[class*="highlight"], [class*="Highlight"],'
                            + '[class*="info"], [class*="Info"],'
                            + '[class*="detail"], [class*="Detail"]'
                        );
                        for (const grid of grids) {
                            const children = grid.children;
                            for (let i = 0; i < children.length - 1; i += 2) {
                                const k = (children[i].innerText || '').trim();
                                const v = (children[i+1].innerText || '').trim();
                                if (k && v && k.length < 60) result[k] = v;
                            }
                        }
                    }

                    return result;
                }
            """)

            if all_kv:
                result["highlights"] = all_kv

            # ─────────────────────────────────────────────────────────────
            # 7. Populate structured fields from the k/v data
            # ─────────────────────────────────────────────────────────────
            for k, v in all_kv.items():
                kl = k.lower().strip()
                vl = str(v).strip()
                if not vl or vl == "N/A":
                    continue
                if "brand" in kl:
                    result["brand"] = vl
                elif "product type" in kl or "producttype" in kl:
                    if result["category"] == "N/A":
                        result["category"] = vl
                elif "fssai" in kl:
                    result["fssai_number"] = vl
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
                elif "shelf life" in kl or "shelf-life" in kl:
                    result["shelf_life"] = vl
                    if result["expiry_date"] == "N/A":
                        result["expiry_date"] = vl
                elif "expiry" in kl or "best before" in kl or "use by" in kl:
                    result["expiry_date"] = vl
                elif "nutritional" in kl or "nutrition" in kl:
                    result["nutritional_info"] = vl
                elif "weight" in kl or "net quantity" in kl or "net weight" in kl:
                    if result["weight"] == "N/A":
                        result["weight"] = vl
                elif "unit" in kl and result["weight"] == "N/A":
                    result["weight"] = vl

            # ─────────────────────────────────────────────────────────────
            # 8. FSSAI fallback – regex scan of page text
            # ─────────────────────────────────────────────────────────────
            if result["fssai_number"] == "N/A":
                page_text = await page.inner_text("body")
                m = re.search(r'\bFSSAI[:\s#]*([\d\s]{14,17})', page_text, re.IGNORECASE)
                if not m:
                    m = re.search(r'\b\d{14}\b', page_text)
                if m:
                    raw = re.sub(r'\D', '', m.group(0) if m.lastindex and m.lastindex >= 1 else m.group(0))
                    if len(raw) >= 14:
                        result["fssai_number"] = raw[:14]

            # ─────────────────────────────────────────────────────────────
            # 9. Description / About
            # ─────────────────────────────────────────────────────────────
            for sel in [
                '[class*="description"]',
                '[class*="Description"]',
                '[class*="about"]',
                '[class*="About"]',
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


        try:
            await page.goto(product_url, timeout=25000, wait_until="domcontentloaded")
            await asyncio.sleep(2)

            # ── Product Name ──────────────────────────────────────────────
            for sel in [
                'h1',
                '[data-slot-id="ProductName"]',
                '[class*="ProductName"]',
                '[class*="product-name"]',
                '[class*="productTitle"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    name = (await el.inner_text()).strip()
                    if name:
                        result["product_name"] = name
                        break

            # ── Price ─────────────────────────────────────────────────────
            for sel in [
                '[data-slot-id="EdlpPrice"] span:first-child',
                '[class*="selling-price"]',
                '[class*="sellingPrice"]',
                '[class*="offer-price"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt:
                        result["price"] = txt.replace("₹", "").strip()
                        break

            # ── MRP ───────────────────────────────────────────────────────
            for sel in [
                '[data-slot-id="EdlpPrice"] span:nth-child(2)',
                '[class*="mrpPrice"]',
                '[class*="mrp"]',
                '[class*="original-price"]',
                "s",  # strikethrough
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt:
                        result["mrp"] = txt.replace("₹", "").strip()
                        break

            # ── Discount badge ────────────────────────────────────────────
            page_text_raw = await page.inner_text("body")
            m = re.search(r'(\d{1,2})\s*%\s*OFF', page_text_raw, re.IGNORECASE)
            if m:
                result["discount"] = f"{m.group(1)}% OFF"

            # ── All product images ────────────────────────────────────────
            images = set()
            for sel in [
                '[class*="ProductImage"] img',
                '[class*="product-image"] img',
                '[class*="carousel"] img',
                '[class*="Carousel"] img',
                '[class*="ImageWrapper"] img',
                '[class*="imageContainer"] img',
                '[class*="pdp"] img',
            ]:
                els = await page.query_selector_all(sel)
                for img_el in els:
                    src = await img_el.get_attribute("src") or ""
                    if not src or src.startswith("data:"):
                        src = await img_el.get_attribute("data-src") or ""
                    if src and src.startswith("http") and "placeholder" not in src.lower():
                        images.add(src)

            # Fallback: all meaningful page images
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
                        try:
                            w = await img_el.get_attribute("width")
                            h = await img_el.get_attribute("height")
                            if w and int(w) < 60:
                                continue
                            if h and int(h) < 60:
                                continue
                        except Exception:
                            pass
                        images.add(src)

            result["images"] = list(images)[:12]

            # ── Description ───────────────────────────────────────────────
            for sel in [
                '[class*="ProductDescription"]',
                '[class*="product-description"]',
                '[class*="AboutSection"]',
                '[class*="about"]',
                '[class*="description"]',
            ]:
                el = await page.query_selector(sel)
                if el:
                    txt = (await el.inner_text()).strip()
                    if txt and len(txt) > 10:
                        result["description"] = txt[:1000]
                        break

            # ── Product Details / Highlights ──────────────────────────────
            highlights = {}

            # Zepto product detail pages often have a "Product Details" section
            # with label:value rows
            detail_rows = await page.query_selector_all(
                '[class*="ProductDetail"] [class*="Row"], '
                '[class*="product-detail"] [class*="row"], '
                '[class*="InfoTable"] tr, '
                '[class*="ProductInfo"] tr'
            )
            for row in detail_rows:
                cells = await row.query_selector_all("td, [class*='Key'], [class*='Value']")
                if len(cells) >= 2:
                    k = (await cells[0].inner_text()).strip()
                    v = (await cells[1].inner_text()).strip()
                    if k and v:
                        highlights[k] = v

            # Generic key-value parsing – look for sibling pairs
            if not highlights:
                sections = await page.query_selector_all(
                    '[class*="detail"], [class*="Detail"], [class*="about"], [class*="About"]'
                )
                for section in sections[:5]:
                    items = await section.query_selector_all("li, p, div")
                    for item in items[:30]:
                        txt = (await item.inner_text()).strip()
                        if ":" in txt and len(txt) < 300:
                            parts = txt.split(":", 1)
                            if len(parts) == 2 and parts[0].strip() and parts[1].strip():
                                highlights[parts[0].strip()] = parts[1].strip()

            result["highlights"] = highlights

            # ── Try to populate regulated fields from highlights ───────────
            for k, v in highlights.items():
                kl = k.lower()
                if "brand" in kl:
                    result["brand"] = v
                elif "fssai" in kl:
                    result["fssai_number"] = v
                elif "ingredient" in kl:
                    result["ingredients"] = v
                elif "manufacturer" in kl and "name" in kl:
                    result["manufacturer_name"] = v
                elif "manufacturer" in kl and "address" in kl:
                    result["manufacturer_address"] = v
                elif "country" in kl and "origin" in kl:
                    result["country_of_origin"] = v
                elif "expiry" in kl or "best before" in kl:
                    result["expiry_date"] = v
                elif "nutritional" in kl or "nutrition" in kl:
                    result["nutritional_info"] = v
                elif "weight" in kl or "quantity" in kl or "volume" in kl or "pack" in kl:
                    if result["weight"] == "N/A":
                        result["weight"] = v
                elif "category" in kl:
                    result["category"] = v

            # ── FSSAI fallback – regex over full page text ────────────────
            if result["fssai_number"] == "N/A":
                fssai_m = re.search(r'\b\d{14}\b', page_text_raw)
                if fssai_m:
                    result["fssai_number"] = fssai_m.group(0)

            # ── Manufacturer fallback from plain text ─────────────────────
            if result["manufacturer_name"] == "N/A":
                mfr_m = re.search(
                    r'(?:Manufactured|Packed|Marketed)\s+by\s*[:\-]?\s*([A-Za-z& ,.()\d]{5,80})',
                    page_text_raw, re.IGNORECASE
                )
                if mfr_m:
                    result["manufacturer_name"] = mfr_m.group(1).strip()

            await browser.close()
            return result

        except Exception:
            traceback.print_exc()
            try:
                await browser.close()
            except Exception:
                pass
            return result
