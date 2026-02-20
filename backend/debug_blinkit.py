import asyncio
import sys
from playwright.async_api import async_playwright

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

async def debug_blinkit():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        print("Navigating to Blinkit home...")
        await page.goto("https://blinkit.com", timeout=30000)
        await page.wait_for_timeout(5000)
        
        # Handle location prompt
        print("Handling location prompt...")
        location_input = await page.query_selector('input[placeholder*="delivery location"]')
        if location_input:
            await location_input.fill("Gurugram")
            await page.wait_for_timeout(3000)
            
            # Click the first suggestion that contains Gurugram
            try:
                # Based on the screenshot, suggestions have the text Gurugram
                await page.click('div:has-text("Gurugram")', timeout=5000)
                print("  ✓ Clicked location suggestion")
            except:
                print("  ⚠️ Could not click suggestion, trying keyboard")
                await page.keyboard.press("ArrowDown")
                await page.wait_for_timeout(1000)
                await page.keyboard.press("Enter")
            
            await page.wait_for_timeout(5000)
        
        await page.screenshot(path="blinkit_after_location.png")
        
        print("Searching for 'poha'...")
        # Search bar might be different now
        search_input = await page.query_selector('input[placeholder*="Search"]')
        if search_input:
            await search_input.fill("poha")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(10000)
            await page.screenshot(path="blinkit_search_results.png")
            
            # Find product links
            links = await page.query_selector_all('a[href*="/prn/"], a[href*="/product/"]')
            print(f"Found {len(links)} product links")
            
            if links:
                product_url = await links[0].get_attribute('href')
                if not product_url.startswith('http'):
                    product_url = f"https://blinkit.com{product_url}"
                
                print(f"Visiting product page: {product_url}")
                await page.goto(product_url, timeout=30000)
                await page.wait_for_timeout(10000)
                await page.screenshot(path="blinkit_product_page.png")
                
                # Save HTML
                html = await page.content()
                with open("blinkit_product_page.html", "w", encoding="utf-8") as f:
                    f.write(html)
                print("  ✓ Saved blinkit_product_page.html")
        else:
            print("  ✗ Could not find search input")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_blinkit())
