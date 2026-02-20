import asyncio
from playwright.async_api import async_playwright

async def debug_zepto():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        print("Navigating to Zepto home...")
        await page.goto("https://www.zeptonow.com", timeout=30000)
        await page.wait_for_timeout(5000)
        await page.screenshot(path="zepto_home.png")
        
        # Check for location prompt
        location_btn = await page.query_selector('text="Select Location"')
        if location_btn:
            print("Handling location prompt...")
            await location_btn.click()
            await page.wait_for_timeout(2000)
            
            # Type and select a location
            location_input = await page.query_selector('input[placeholder*="location"]')
            if location_input:
                await location_input.fill("Mumbai")
                await page.wait_for_timeout(3000)
                await page.keyboard.press("ArrowDown")
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(5000)
        
        url = "https://www.zeptonow.com/search?query=poha"
        print(f"Searching for 'poha': {url}")
        await page.goto(url, timeout=30000)
        await page.wait_for_timeout(10000)
        
        await page.screenshot(path="zepto_search_debug.png")
        content = await page.content()
        with open("zepto_search_debug.html", "w", encoding="utf-8") as f:
            f.write(content)
            
        # Check for product links
        links = await page.query_selector_all('a[href*="/pn/"]')
        print(f"Found {len(links)} product links.")
        
        if links:
            href = await links[0].get_attribute('href')
            print(f"First link: {href}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_zepto())
