import asyncio
import sys

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from playwright.async_api import async_playwright

async def capture_product_pages():
    """
    Capture HTML from actual product pages on Blinkit and Zepto
    to analyze structure and identify selectors for compliance fields
    """
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        
        # === BLINKIT PRODUCT PAGE ===
        print("Capturing Blinkit product page...")
        page = await context.new_page()
        
        try:
            # First get search results to find a product URL
            await page.goto("https://blinkit.com/s/?q=Tata+Sampann+Poha", timeout=30000)
            
            # Handle potential location modal
            await page.wait_for_timeout(3000)
            location_modal = await page.query_selector('input[placeholder*="delivery location"]')
            if location_modal:
                print("  Handling Blinkit location modal...")
                await location_modal.fill("Gurugram")
                await page.wait_for_timeout(2000)
                await page.keyboard.press("ArrowDown")
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(5000)
            
            # Find products directly from the search results
            # Filter for containers that look like products (numeric IDs)
            all_buttons = await page.query_selector_all('div[role="button"]')
            containers = []
            for btn in all_buttons:
                btn_id = await btn.get_attribute("id")
                if btn_id and btn_id.isdigit():
                    containers.append(btn)
            
            if containers:
                print(f"  Found {len(containers)} product containers, clicking first one...")
                # Scroll into view to avoid intersections
                await containers[0].scroll_into_view_if_needed()
                await containers[0].click(force=True)
                
                # Wait for modal to appear and load content
                print("  Waiting for product modal...")
                try:
                    await page.wait_for_selector('div[role="dialog"], [class*="Modal"], [class*="ProductDescription"]', timeout=15000)
                except:
                    print("  ⚠️ Modal selector timeout, attempting fallback capture...")
                
                await page.wait_for_timeout(5000) # Buffer for dynamic content (FSSAI/Ingredients)
                
                # Save HTML (this should now include the product detail modal)
                html = await page.content()
                with open("find_me_if_you_can.html", "w", encoding="utf-8") as f:
                    f.write(html)
                print("  ✓ Saved find_me_if_you_can.html")
                await page.screenshot(path="blinkit_modal_debug.png")
                print("  ✓ Saved blinkit_modal_debug.png")
            else:
                print("  ✗ No product containers found")
                await page.screenshot(path="blinkit_search_debug.png")
                
        except Exception as e:
            print(f"  ✗ Blinkit error: {e}")
            await page.screenshot(path="blinkit_error_debug.png")
        
        # === ZEPTO PRODUCT PAGE ===
        print("\nCapturing Zepto product page...")
        page2 = await context.new_page()
        
        try:
            # Get search results
            await page2.goto("https://www.zeptonow.com/search?query=Tata+Sampann+Poha", timeout=20000)
            await page2.wait_for_timeout(5000)
            await page2.screenshot(path="zepto_search_debug.png")
            
            # Find first product link that contains "poha" or is a food item
            product_links = await page2.query_selector_all('a[href*="/pn/"]')
            target_url = None
            for link in product_links:
                href = await link.get_attribute('href')
                if "poha" in href.lower():
                    target_url = href
                    break
            
            if not target_url and product_links:
                target_url = await product_links[0].get_attribute('href')
                
            if target_url:
                if not target_url.startswith('http'):
                    target_url = f"https://www.zeptonow.com{target_url}"
                
                print(f"  Found product URL: {target_url}")
                
                # Visit product page
                await page2.goto(target_url, timeout=20000)
                await page2.wait_for_timeout(5000)  # Wait for dynamic content
                await page2.screenshot(path="zepto_product_debug.png")
                
                # Save HTML
                html = await page2.content()
                with open("zepto_product_page.html", "w", encoding="utf-8") as f:
                    f.write(html)
                print("  ✓ Saved zepto_product_page.html")
            else:
                print("  ✗ No product links found")
                
        except Exception as e:
            print(f"  ✗ Zepto error: {e}")
            await page2.screenshot(path="zepto_error_debug.png")
        
        await browser.close()
        print("\n✓ Product page capture complete!")

if __name__ == "__main__":
    asyncio.run(capture_product_pages())
